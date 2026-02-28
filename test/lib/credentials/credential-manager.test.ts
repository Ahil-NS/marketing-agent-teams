import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { CredentialManager } from '../../../src/lib/credentials/index.js'
import { CredentialNotFoundError, CredentialStoreError } from '../../../src/lib/credentials/errors.js'
import type { KeychainAdapter, Platform, TokenData } from '../../../src/lib/credentials/types.js'
import { createTestDir, removeTestDir } from '../../helpers/test-project.js'

function createMockKeychain(): KeychainAdapter & {
  store: Map<string, string>
} {
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
  accessToken: 'test-access-token-abc123',
  refreshToken: 'test-refresh-token-xyz789',
  expiresAt: '2026-04-01T00:00:00Z',
}

describe('CredentialManager', () => {
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

  describe('store()', () => {
    it('stores tokens in keychain and writes metadata', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read', 'submit'])

      // Verify keychain received the tokens
      const stored = keychain.store.get('reddit')
      expect(stored).toBeDefined()
      const parsed = JSON.parse(stored!)
      expect(parsed.accessToken).toBe(SAMPLE_TOKENS.accessToken)
      expect(parsed.refreshToken).toBe(SAMPLE_TOKENS.refreshToken)
      expect(parsed.expiresAt).toBe(SAMPLE_TOKENS.expiresAt)

      // Verify metadata file written (no tokens)
      const metadataPath = join(testDir, '.mat', 'credentials', 'platforms.json')
      const raw = await readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(raw)
      expect(metadata.platforms).toHaveLength(1)
      expect(metadata.platforms[0].platform).toBe('reddit')
      expect(metadata.platforms[0].connected).toBe(true)
      expect(metadata.platforms[0].scopes).toEqual(['read', 'submit'])
      // Tokens must NOT appear in metadata
      expect(raw).not.toContain('test-access-token')
      expect(raw).not.toContain('test-refresh-token')
    })

    it('updates existing platform entry on re-store', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      const newTokens: TokenData = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: '2026-05-01T00:00:00Z',
      }
      await manager.store('reddit', newTokens, ['read', 'submit'])

      const metadataPath = join(testDir, '.mat', 'credentials', 'platforms.json')
      const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'))
      expect(metadata.platforms).toHaveLength(1)
      expect(metadata.platforms[0].scopes).toEqual(['read', 'submit'])
    })

    it('stores multiple platforms', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      await manager.store('tiktok', SAMPLE_TOKENS, ['video.list'])

      const metadataPath = join(testDir, '.mat', 'credentials', 'platforms.json')
      const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'))
      expect(metadata.platforms).toHaveLength(2)
    })

    it('throws CredentialStoreError when keychain fails', async () => {
      const failKeychain: KeychainAdapter = {
        async setPassword() {
          throw new Error('Keychain locked')
        },
        async getPassword() {
          return null
        },
        async deletePassword() {
          return false
        },
      }
      const failManager = new CredentialManager(failKeychain, testDir)
      await expect(failManager.store('reddit', SAMPLE_TOKENS)).rejects.toThrow(CredentialStoreError)
    })
  })

  describe('retrieve()', () => {
    it('retrieves stored tokens from keychain', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)
      const entry = await manager.retrieve('reddit')
      expect(entry.platform).toBe('reddit')
      expect(entry.tokens.accessToken).toBe(SAMPLE_TOKENS.accessToken)
      expect(entry.tokens.refreshToken).toBe(SAMPLE_TOKENS.refreshToken)
    })

    it('throws CredentialNotFoundError for unknown platform', async () => {
      await expect(manager.retrieve('reddit')).rejects.toThrow(CredentialNotFoundError)
    })
  })

  describe('remove()', () => {
    it('removes tokens from keychain and updates metadata', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)
      await manager.remove('reddit')

      const entry = await keychain.getPassword('marketing-agent-teams', 'reddit')
      expect(entry).toBeNull()

      const metadataPath = join(testDir, '.mat', 'credentials', 'platforms.json')
      const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'))
      const reddit = metadata.platforms.find((p: { platform: string }) => p.platform === 'reddit')
      expect(reddit).toBeUndefined()
    })

    it('throws CredentialNotFoundError if platform not stored', async () => {
      await expect(manager.remove('tiktok')).rejects.toThrow(CredentialNotFoundError)
    })
  })

  describe('token redaction (AC #3, 7.5)', () => {
    it('tokens never appear in metadata file', async () => {
      const sensitiveToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.super-secret'
      const tokens: TokenData = {
        accessToken: sensitiveToken,
        refreshToken: 'refresh-secret-abc123',
        expiresAt: '2026-04-01T00:00:00Z',
      }
      await manager.store('reddit', tokens, ['read'])

      const metadataPath = join(testDir, '.mat', 'credentials', 'platforms.json')
      const raw = await readFile(metadataPath, 'utf-8')
      expect(raw).not.toContain(sensitiveToken)
      expect(raw).not.toContain('refresh-secret-abc123')
      expect(raw).not.toContain('accessToken')
      expect(raw).not.toContain('refreshToken')
    })

    it('list() output never contains token data', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      const list = await manager.list()
      const output = JSON.stringify(list)
      expect(output).not.toContain(SAMPLE_TOKENS.accessToken)
      expect(output).not.toContain(SAMPLE_TOKENS.refreshToken)
    })
  })

  describe('Zod validation', () => {
    it('handles corrupted metadata file gracefully', async () => {
      const metadataPath = join(testDir, '.mat', 'credentials', 'platforms.json')
      await writeFile(metadataPath, '{"platforms": [{"invalid": true}]}', 'utf-8')

      // loadMetadata should fall back to empty when validation fails
      const list = await manager.list()
      expect(list).toEqual([])
    })

    it('rejects corrupted token data from keychain', async () => {
      // Store valid tokens first, then corrupt them in the mock
      keychain.store.set('reddit', '{"bad": "data"}')

      const { CredentialStoreError } = await import('../../../src/lib/credentials/errors.js')
      await expect(manager.retrieve('reddit')).rejects.toThrow(CredentialStoreError)
    })

    it('retrieves valid token data after Zod validation', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)
      const entry = await manager.retrieve('reddit')
      expect(entry.tokens.accessToken).toBe(SAMPLE_TOKENS.accessToken)
      expect(entry.tokens.refreshToken).toBe(SAMPLE_TOKENS.refreshToken)
      expect(entry.tokens.expiresAt).toBe(SAMPLE_TOKENS.expiresAt)
    })
  })

  describe('list()', () => {
    it('returns empty array when no platforms connected', async () => {
      const list = await manager.list()
      expect(list).toEqual([])
    })

    it('returns metadata without tokens', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      await manager.store('facebook', SAMPLE_TOKENS, ['pages_manage_posts'])

      const list = await manager.list()
      expect(list).toHaveLength(2)
      expect(list[0].platform).toBe('reddit')
      expect(list[0].connected).toBe(true)
      // Ensure no token data leaks
      const serialized = JSON.stringify(list)
      expect(serialized).not.toContain('test-access-token')
      expect(serialized).not.toContain('test-refresh-token')
    })
  })
})
