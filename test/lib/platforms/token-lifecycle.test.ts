import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {KeychainAdapter, TokenData} from '../../../src/lib/credentials/types.js'
import {CredentialManager} from '../../../src/lib/credentials/credential-manager.js'
import {AdapterRegistry} from '../../../src/lib/platforms/adapter-registry.js'
import {PlatformConnectionManager} from '../../../src/lib/platforms/connection-manager.js'
import {TokenLifecycleManager, REFRESH_WINDOWS} from '../../../src/lib/platforms/token-lifecycle.js'
import {StubAdapter} from '../../../src/lib/platforms/adapters/stub-adapter.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

class InMemoryKeychain implements KeychainAdapter {
  private store = new Map<string, string>()
  private key(service: string, account: string): string {
    return `${service}:${account}`
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    this.store.set(this.key(service, account), password)
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    return this.store.get(this.key(service, account)) ?? null
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    return this.store.delete(this.key(service, account))
  }
}

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()
}

function pastDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

describe('TokenLifecycleManager', () => {
  let testDir: string
  let keychain: InMemoryKeychain
  let credManager: CredentialManager
  let registry: AdapterRegistry
  let connectionManager: PlatformConnectionManager
  let lifecycle: TokenLifecycleManager

  beforeEach(async () => {
    testDir = await createTestDir()
    keychain = new InMemoryKeychain()
    credManager = new CredentialManager(keychain, testDir)
    registry = new AdapterRegistry()
    connectionManager = new PlatformConnectionManager(credManager, registry)
    lifecycle = new TokenLifecycleManager(credManager, connectionManager)
  })

  afterEach(async () => {
    await removeTestDir(testDir)
  })

  describe('REFRESH_WINDOWS', () => {
    it('has 7-day windows for reddit, tiktok, facebook', () => {
      expect(REFRESH_WINDOWS.reddit).toBe(7)
      expect(REFRESH_WINDOWS.tiktok).toBe(7)
      expect(REFRESH_WINDOWS.facebook).toBe(7)
    })

    it('has 14-day window for instagram (NFR19)', () => {
      expect(REFRESH_WINDOWS.instagram).toBe(14)
    })
  })

  describe('checkExpiringTokens', () => {
    it('returns empty array when no platforms are connected', async () => {
      const result = await lifecycle.checkExpiringTokens()
      expect(result).toEqual([])
    })

    it('returns empty when all tokens are outside refresh window', async () => {
      await credManager.store('reddit', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }, ['read'])

      const result = await lifecycle.checkExpiringTokens()
      expect(result).toEqual([])
    })

    it('identifies token within 7-day window for reddit', async () => {
      const expiresAt = futureDate(5) // 5 days — within 7-day window
      await credManager.store('reddit', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt,
      }, ['read'])

      const result = await lifecycle.checkExpiringTokens()
      expect(result).toHaveLength(1)
      expect(result[0].platform).toBe('reddit')
      expect(result[0].daysUntilExpiry).toBeCloseTo(5, 0)
      expect(result[0].refreshWindowDays).toBe(7)
    })

    it('uses 14-day window for instagram (NFR19)', async () => {
      const expiresAt = futureDate(10) // 10 days — within 14-day window for Instagram
      await credManager.store('instagram', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt,
      }, ['instagram_basic'])

      const result = await lifecycle.checkExpiringTokens()
      expect(result).toHaveLength(1)
      expect(result[0].platform).toBe('instagram')
      expect(result[0].refreshWindowDays).toBe(14)
    })

    it('does not flag instagram with 10-day window as needing standard refresh', async () => {
      // 10 days from now is NOT within the 7-day window
      const expiresAt = futureDate(10)
      await credManager.store('facebook', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt,
      }, [])

      const result = await lifecycle.checkExpiringTokens()
      expect(result).toHaveLength(0)
    })

    it('includes expired tokens (daysUntilExpiry <= 0)', async () => {
      await credManager.store('tiktok', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: pastDate(2),
      }, [])

      const result = await lifecycle.checkExpiringTokens()
      expect(result).toHaveLength(1)
      expect(result[0].platform).toBe('tiktok')
      expect(result[0].daysUntilExpiry).toBe(0) // Floored to 0
    })

    it('returns multiple expiring tokens', async () => {
      await credManager.store('reddit', {
        accessToken: 'at1',
        refreshToken: 'rt1',
        expiresAt: futureDate(3),
      }, [])

      await credManager.store('facebook', {
        accessToken: 'at2',
        refreshToken: 'rt2',
        expiresAt: futureDate(5),
      }, [])

      const result = await lifecycle.checkExpiringTokens()
      expect(result).toHaveLength(2)
      const platforms = result.map((t) => t.platform).sort()
      expect(platforms).toEqual(['facebook', 'reddit'])
    })
  })

  describe('refreshExpiringTokens', () => {
    it('returns empty summary when no tokens are expiring', async () => {
      await credManager.store('reddit', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }, [])

      const summary = await lifecycle.refreshExpiringTokens()
      expect(summary.refreshed).toEqual([])
      expect(summary.failed).toEqual([])
    })

    it('refreshes token successfully when adapter is available', async () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      await credManager.store('reddit', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(3), // Within 7-day window
      }, ['read'])

      const summary = await lifecycle.refreshExpiringTokens()
      expect(summary.refreshed).toEqual(['reddit'])
      expect(summary.failed).toEqual([])
    })

    it('returns failure when adapter is not registered', async () => {
      await credManager.store('tiktok', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(3),
      }, [])

      const summary = await lifecycle.refreshExpiringTokens()
      expect(summary.refreshed).toEqual([])
      expect(summary.failed).toHaveLength(1)
      expect(summary.failed[0].platform).toBe('tiktok')
      expect(summary.failed[0].reAuthCommand).toBe('mat config platforms add tiktok')
    })

    it('handles partial failure — some refresh, some fail', async () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      registry.register(new StubAdapter({platform: 'facebook', shouldFailAuth: true}))

      await credManager.store('reddit', {
        accessToken: 'at1',
        refreshToken: 'rt1',
        expiresAt: futureDate(3),
      }, [])

      await credManager.store('facebook', {
        accessToken: 'at2',
        refreshToken: 'rt2',
        expiresAt: futureDate(3),
      }, [])

      const summary = await lifecycle.refreshExpiringTokens()
      expect(summary.refreshed).toEqual(['reddit'])
      expect(summary.failed).toHaveLength(1)
      expect(summary.failed[0].platform).toBe('facebook')
    })

    it('handles adapter throwing exception during refresh', async () => {
      const badAdapter = new StubAdapter({platform: 'instagram'})
      vi.spyOn(badAdapter, 'authenticate').mockRejectedValue(new Error('API down'))
      registry.register(badAdapter)

      await credManager.store('instagram', {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(10), // Within 14-day window for Instagram
      }, [])

      const summary = await lifecycle.refreshExpiringTokens()
      expect(summary.refreshed).toEqual([])
      expect(summary.failed).toHaveLength(1)
      expect(summary.failed[0].error).toBe('API down')
    })
  })
})
