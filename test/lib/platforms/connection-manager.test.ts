import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {KeychainAdapter, PlatformCredential, TokenData} from '../../../src/lib/credentials/types.js'
import {CredentialManager} from '../../../src/lib/credentials/credential-manager.js'
import {AdapterRegistry} from '../../../src/lib/platforms/adapter-registry.js'
import {
  PlatformConnectionManager,
  PlatformConnectionNotFoundError,
} from '../../../src/lib/platforms/connection-manager.js'
import type {PlatformConnection} from '../../../src/lib/platforms/connection-manager.js'
import {StubAdapter} from '../../../src/lib/platforms/adapters/stub-adapter.js'
import type {PlatformName} from '../../../src/lib/platforms/types.js'
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

describe('PlatformConnectionManager', () => {
  let testDir: string
  let keychain: InMemoryKeychain
  let credManager: CredentialManager
  let registry: AdapterRegistry
  let manager: PlatformConnectionManager

  beforeEach(async () => {
    testDir = await createTestDir()
    keychain = new InMemoryKeychain()
    credManager = new CredentialManager(keychain, testDir)
    registry = new AdapterRegistry()
    manager = new PlatformConnectionManager(credManager, registry)
  })

  afterEach(async () => {
    await removeTestDir(testDir)
  })

  describe('listConnections', () => {
    it('returns all platforms with not-connected status when none are stored', async () => {
      const connections = await manager.listConnections()
      expect(connections).toHaveLength(4)
      for (const conn of connections) {
        expect(conn.status).toBe('not-connected')
        expect(conn.scopes).toEqual([])
      }
    })

    it('returns connected status for stored platform with valid token', async () => {
      const tokens: TokenData = {
        accessToken: 'at-reddit',
        refreshToken: 'rt-reddit',
        expiresAt: futureDate(30),
      }
      await credManager.store('reddit', tokens, ['submit', 'read'])

      const connections = await manager.listConnections()
      const reddit = connections.find((c) => c.platform === 'reddit')!
      expect(reddit.status).toBe('connected')
      expect(reddit.scopes).toEqual(['submit', 'read'])
      expect(reddit.expiresAt).toBeDefined()
    })

    it('returns expiring status for token within warning window', async () => {
      const tokens: TokenData = {
        accessToken: 'at-reddit',
        refreshToken: 'rt-reddit',
        expiresAt: futureDate(3), // 3 days — within 7-day window
      }
      await credManager.store('reddit', tokens, ['read'])

      const connections = await manager.listConnections()
      const reddit = connections.find((c) => c.platform === 'reddit')!
      expect(reddit.status).toBe('expiring')
    })

    it('returns expired status for token past expiry', async () => {
      const tokens: TokenData = {
        accessToken: 'at-tiktok',
        refreshToken: 'rt-tiktok',
        expiresAt: pastDate(1), // 1 day ago
      }
      await credManager.store('tiktok', tokens, ['user.info.basic'])

      const connections = await manager.listConnections()
      const tiktok = connections.find((c) => c.platform === 'tiktok')!
      expect(tiktok.status).toBe('expired')
    })

    it('uses 14-day window for instagram', async () => {
      const tokens: TokenData = {
        accessToken: 'at-ig',
        refreshToken: 'rt-ig',
        expiresAt: futureDate(10), // 10 days — within 14-day window for Instagram
      }
      await credManager.store('instagram', tokens, ['instagram_basic'])

      const connections = await manager.listConnections()
      const ig = connections.find((c) => c.platform === 'instagram')!
      expect(ig.status).toBe('expiring')
    })

    it('instagram with 10-day expiry is connected for other platforms', async () => {
      const tokens: TokenData = {
        accessToken: 'at-fb',
        refreshToken: 'rt-fb',
        expiresAt: futureDate(10), // 10 days — NOT within 7-day window for Facebook
      }
      await credManager.store('facebook', tokens, ['pages_manage_posts'])

      const connections = await manager.listConnections()
      const fb = connections.find((c) => c.platform === 'facebook')!
      expect(fb.status).toBe('connected')
    })
  })

  describe('removeConnection', () => {
    it('removes a connected platform', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('reddit', tokens, ['read'])
      registry.register(new StubAdapter({platform: 'reddit'}))

      await manager.removeConnection('reddit')

      // Verify removed from metadata
      const platforms = await credManager.list()
      expect(platforms.find((p) => p.platform === 'reddit')).toBeUndefined()

      // Verify deregistered from adapter registry
      expect(registry.has('reddit')).toBe(false)
    })

    it('throws PlatformConnectionNotFoundError for non-connected platform', async () => {
      await expect(manager.removeConnection('reddit')).rejects.toThrow(PlatformConnectionNotFoundError)
    })

    it('works even if adapter is not registered', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('tiktok', tokens, [])

      // No adapter registered — should still remove successfully
      await manager.removeConnection('tiktok')
      const platforms = await credManager.list()
      expect(platforms.find((p) => p.platform === 'tiktok')).toBeUndefined()
    })
  })

  describe('refreshToken', () => {
    it('returns failure when no adapter is registered', async () => {
      const result = await manager.refreshToken('reddit')
      expect(result.success).toBe(false)
      expect(result.error).toContain('No adapter registered')
      expect(result.reAuthCommand).toBe('mat config platforms add reddit')
    })

    it('returns failure when adapter authenticate() fails', async () => {
      registry.register(new StubAdapter({platform: 'reddit', shouldFailAuth: true}))
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('reddit', tokens, ['read'])

      const result = await manager.refreshToken('reddit')
      expect(result.success).toBe(false)
      expect(result.reAuthCommand).toBe('mat config platforms add reddit')
    })

    it('returns success when authenticate() succeeds', async () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('reddit', tokens, ['read'])

      const result = await manager.refreshToken('reddit')
      expect(result.success).toBe(true)
      expect(result.platform).toBe('reddit')
    })

    it('returns failure with reAuthCommand when authentication throws', async () => {
      const badAdapter = new StubAdapter({platform: 'facebook'})
      vi.spyOn(badAdapter, 'authenticate').mockRejectedValue(new Error('Network timeout'))
      registry.register(badAdapter)

      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('facebook', tokens, [])

      const result = await manager.refreshToken('facebook')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Network timeout')
      expect(result.reAuthCommand).toBe('mat config platforms add facebook')
    })
  })

  describe('checkHealth', () => {
    it('returns invalid for not-connected platform', async () => {
      const result = await manager.checkHealth('reddit')
      expect(result.healthy).toBe(false)
      expect(result.status).toBe('invalid')
      expect(result.issues).toHaveLength(1)
    })

    it('returns expired for platform with expired token', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: pastDate(2),
      }
      await credManager.store('tiktok', tokens, [])

      const result = await manager.checkHealth('tiktok')
      expect(result.healthy).toBe(false)
      expect(result.status).toBe('expired')
    })

    it('returns healthy for connected platform with valid token and successful auth', async () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('reddit', tokens, ['read'])

      const result = await manager.checkHealth('reddit')
      expect(result.healthy).toBe(true)
      expect(result.status).toBe('healthy')
      expect(result.issues).toHaveLength(0)
    })

    it('returns expiring status with issues for token in warning window', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(5),
      }
      await credManager.store('reddit', tokens, ['read'])

      const result = await manager.checkHealth('reddit')
      expect(result.healthy).toBe(true)
      expect(result.status).toBe('expiring')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]).toContain('expires in')
    })

    it('returns invalid when adapter authenticate() fails', async () => {
      registry.register(new StubAdapter({platform: 'facebook', shouldFailAuth: true}))
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('facebook', tokens, ['pages_manage_posts'])

      const result = await manager.checkHealth('facebook')
      expect(result.healthy).toBe(false)
      expect(result.status).toBe('invalid')
      expect(result.issues.some((i) => i.includes('Authentication validation failed'))).toBe(true)
    })

    it('returns invalid when adapter authenticate() throws', async () => {
      const badAdapter = new StubAdapter({platform: 'instagram'})
      vi.spyOn(badAdapter, 'authenticate').mockRejectedValue(new Error('Connection refused'))
      registry.register(badAdapter)

      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('instagram', tokens, ['instagram_basic'])

      const result = await manager.checkHealth('instagram')
      expect(result.healthy).toBe(false)
      expect(result.status).toBe('invalid')
      expect(result.issues.some((i) => i.includes('Connection refused'))).toBe(true)
    })
  })

  describe('getPlatformConnectionStatus', () => {
    it('returns status for all platforms', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(30),
      }
      await credManager.store('reddit', tokens, ['read', 'submit'])

      const statuses = await manager.getPlatformConnectionStatus()
      expect(statuses).toHaveLength(4)

      const reddit = statuses.find((s) => s.platform === 'reddit')!
      expect(reddit.status).toBe('connected')
      expect(reddit.scopeCount).toBe(2)
      expect(reddit.warningMessage).toBeUndefined()

      const tiktok = statuses.find((s) => s.platform === 'tiktok')!
      expect(tiktok.status).toBe('not-connected')
    })

    it('includes warning message for expiring tokens', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: futureDate(3),
      }
      await credManager.store('facebook', tokens, [])

      const statuses = await manager.getPlatformConnectionStatus()
      const fb = statuses.find((s) => s.platform === 'facebook')!
      expect(fb.status).toBe('expiring')
      expect(fb.warningMessage).toContain('mat config platforms add facebook')
    })

    it('includes error message for expired tokens', async () => {
      const tokens: TokenData = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: pastDate(1),
      }
      await credManager.store('instagram', tokens, [])

      const statuses = await manager.getPlatformConnectionStatus()
      const ig = statuses.find((s) => s.platform === 'instagram')!
      expect(ig.status).toBe('expired')
      expect(ig.warningMessage).toContain('expired')
    })
  })

  describe('retry queue re-enablement', () => {
    it('re-enables retry items after successful refresh', async () => {
      // Create a retry queue directory with a pending item
      const matDir = join(testDir, '.mat')
      const queueDir = join(matDir, 'state', 'retry-queue')
      await mkdir(queueDir, {recursive: true})

      const retryItem = {
        itemId: 'item-1',
        platform: 'reddit',
        content: {
          itemId: 'item-1',
          platform: 'reddit',
          content: {title: 'Test', body: 'Test body', platformMeta: {}},
        },
        state: 'pending',
        error: {code: 'PLATFORM_AUTH_FAILED', message: 'Auth failed', classification: 'transient'},
        attemptCount: 2,
        maxAttempts: 10,
        firstFailedAt: pastDate(1),
        lastAttemptAt: pastDate(0),
        nextRetryAt: futureDate(1), // Not eligible yet
        resolution: null,
      }
      await writeFile(join(queueDir, 'item-1.json'), JSON.stringify(retryItem), 'utf-8')

      // Set up retry queue and connection manager
      const {RetryQueue} = await import('../../../src/lib/platforms/retry-queue/index.js')
      const retryQueue = new RetryQueue({matDir})
      const managerWithQueue = new PlatformConnectionManager(credManager, registry, retryQueue)

      // Store credentials and register adapter
      const tokens: TokenData = {accessToken: 'at', refreshToken: 'rt', expiresAt: futureDate(30)}
      await credManager.store('reddit', tokens, ['read'])
      registry.register(new StubAdapter({platform: 'reddit'}))

      // Mock process.cwd to return testDir for the re-enable logic
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir)

      const result = await managerWithQueue.refreshToken('reddit')
      expect(result.success).toBe(true)

      // Verify the retry item's nextRetryAt was updated
      const updatedRaw = await readFile(join(queueDir, 'item-1.json'), 'utf-8')
      const updatedItem = JSON.parse(updatedRaw)
      const updatedNextRetry = new Date(updatedItem.nextRetryAt)
      // Should be set to approximately now, not the future date
      expect(updatedNextRetry.getTime()).toBeLessThanOrEqual(Date.now() + 5000)

      cwdSpy.mockRestore()
    })
  })
})
