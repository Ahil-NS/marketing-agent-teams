import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { CredentialManager } from '../../../src/lib/credentials/index.js'
import { CredentialNotFoundError } from '../../../src/lib/credentials/index.js'
import { SUPPORTED_PLATFORMS } from '../../../src/lib/credentials/index.js'
import type { KeychainAdapter, TokenData } from '../../../src/lib/credentials/types.js'
import { createTestDir, removeTestDir } from '../../helpers/test-project.js'

function createMockKeychain(): KeychainAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async setPassword(_service: string, account: string, password: string) {
      store.set(account, password)
    },
    async getPassword(_service: string, account: string) {
      return store.get(account) ?? null
    },
    async deletePassword(_service: string, account: string) {
      return store.delete(account)
    },
  }
}

const SAMPLE_TOKENS: TokenData = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: '2026-04-01T00:00:00Z',
}

describe('config platforms command logic', () => {
  let testDir: string
  let keychain: ReturnType<typeof createMockKeychain>
  let manager: CredentialManager

  beforeEach(async () => {
    testDir = await createTestDir()
    await mkdir(join(testDir, '.mat', 'credentials'), { recursive: true })
    keychain = createMockKeychain()
    manager = new CredentialManager(keychain, testDir)
  })

  afterEach(async () => {
    await removeTestDir(testDir)
  })

  describe('list (AC #1)', () => {
    it('returns empty array when no platforms connected', async () => {
      const platforms = await manager.list()
      expect(platforms).toEqual([])
    })

    it('returns connected platforms with metadata (no tokens exposed)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read', 'submit'])
      await manager.store('tiktok', SAMPLE_TOKENS, ['video.list'])

      const platforms = await manager.list()
      expect(platforms).toHaveLength(2)
      expect(platforms[0].platform).toBe('reddit')
      expect(platforms[0].connected).toBe(true)
      expect(platforms[0].scopes).toEqual(['read', 'submit'])

      // AC #3: tokens never in metadata
      const serialized = JSON.stringify(platforms)
      expect(serialized).not.toContain('test-access-token')
      expect(serialized).not.toContain('test-refresh-token')
    })
  })

  describe('add flow (AC #1)', () => {
    it('SUPPORTED_PLATFORMS includes all 4 platforms', () => {
      expect(SUPPORTED_PLATFORMS).toContain('reddit')
      expect(SUPPORTED_PLATFORMS).toContain('tiktok')
      expect(SUPPORTED_PLATFORMS).toContain('facebook')
      expect(SUPPORTED_PLATFORMS).toContain('instagram')
      expect(SUPPORTED_PLATFORMS).toHaveLength(4)
    })
  })

  describe('remove flow (AC #1)', () => {
    it('removes credentials and metadata', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      await manager.remove('reddit')

      const platforms = await manager.list()
      expect(platforms).toHaveLength(0)

      // Verify keychain entry removed
      const raw = await keychain.getPassword('marketing-agent-teams', 'reddit')
      expect(raw).toBeNull()
    })

    it('throws CredentialNotFoundError for unconnected platform', async () => {
      await expect(manager.remove('facebook')).rejects.toThrow(CredentialNotFoundError)
    })
  })

  describe('JSON output (AC #1)', () => {
    it('metadata serializes cleanly without tokens', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      const platforms = await manager.list()

      const jsonOutput = JSON.stringify({ platforms })
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.platforms).toHaveLength(1)
      expect(parsed.platforms[0].platform).toBe('reddit')
      expect(jsonOutput).not.toContain('test-access-token')
    })
  })
})

describe('command structure', () => {
  it('PlatformsList command exists and has enableJsonFlag', async () => {
    const { default: PlatformsList } = await import('../../../src/commands/config/platforms/index.js')
    expect(PlatformsList).toBeDefined()
    expect(PlatformsList.enableJsonFlag).toBe(true)
  })

  it('PlatformsAdd command restricts to supported platforms', async () => {
    const { default: PlatformsAdd } = await import('../../../src/commands/config/platforms/add.js')
    expect(PlatformsAdd).toBeDefined()
    expect(PlatformsAdd.args.platform.options).toEqual([...SUPPORTED_PLATFORMS])
  })

  it('PlatformsRemove command restricts to supported platforms', async () => {
    const { default: PlatformsRemove } = await import('../../../src/commands/config/platforms/remove.js')
    expect(PlatformsRemove).toBeDefined()
    expect(PlatformsRemove.args.platform.options).toEqual([...SUPPORTED_PLATFORMS])
  })
})
