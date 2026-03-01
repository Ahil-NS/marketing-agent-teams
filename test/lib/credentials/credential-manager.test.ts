import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { CredentialManager } from '../../../src/lib/credentials/index.js'
import { CredentialNotFoundError, CredentialStoreError, TrustViolationError, CredentialAccessDeniedError } from '../../../src/lib/credentials/errors.js'
import type { KeychainAdapter, TokenData } from '../../../src/lib/credentials/types.js'
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

  describe('resolveForAgent()', () => {
    it('returns only declared credential (AC1: single platform)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      await manager.store('tiktok', { ...SAMPLE_TOKENS, accessToken: 'tiktok-token-xyz' }, ['video.list'])

      const context = await manager.resolveForAgent('trend-scout', {
        credentials: ['reddit'],
      })

      expect(context.size).toBe(1)
      expect(context.get('reddit')).toBe(SAMPLE_TOKENS.accessToken)
      expect(context.has('tiktok')).toBe(false)
    })

    it('returns multiple declared credentials (AC1: multi-platform)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      await manager.store('tiktok', { ...SAMPLE_TOKENS, accessToken: 'tiktok-token-xyz' }, ['video.list'])
      await manager.store('facebook', { ...SAMPLE_TOKENS, accessToken: 'fb-token-abc' }, ['pages_manage_posts'])

      const context = await manager.resolveForAgent('content-creator', {
        credentials: ['reddit', 'tiktok'],
      })

      expect(context.size).toBe(2)
      expect(context.get('reddit')).toBe(SAMPLE_TOKENS.accessToken)
      expect(context.get('tiktok')).toBe('tiktok-token-xyz')
      expect(context.has('facebook')).toBe(false)
    })

    it('returns empty context for empty permissions.credentials (AC3)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)

      const context = await manager.resolveForAgent('analyzer', {
        credentials: [],
      })

      expect(context.size).toBe(0)
    })

    it('returns empty context for missing permissions block (AC3)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)

      const context = await manager.resolveForAgent('analyzer')

      expect(context.size).toBe(0)
    })

    it('returns empty context for undefined permissions.credentials (AC3)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)

      const context = await manager.resolveForAgent('analyzer', {})

      expect(context.size).toBe(0)
    })

    it('skips missing platform tokens without throwing', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)
      // tiktok not stored — should be silently skipped

      const context = await manager.resolveForAgent('content-creator', {
        credentials: ['reddit', 'tiktok'],
      })

      expect(context.size).toBe(1)
      expect(context.get('reddit')).toBe(SAMPLE_TOKENS.accessToken)
      expect(context.has('tiktok')).toBe(false)
    })

    it('returns immutable CredentialContext (cannot be modified)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)

      const context = await manager.resolveForAgent('trend-scout', {
        credentials: ['reddit'],
      })

      // ImmutableCredentialContext has no set/delete/clear methods
      expect((context as Record<string, unknown>).set).toBeUndefined()
      expect((context as Record<string, unknown>).delete).toBeUndefined()
      expect((context as Record<string, unknown>).clear).toBeUndefined()

      // ReadonlyMap interface — only read methods available
      expect(context.get('reddit')).toBe(SAMPLE_TOKENS.accessToken)
      expect(context.size).toBe(1)
    })

    it('CredentialContext is not JSON-serializable (toJSON prevention)', async () => {
      await manager.store('reddit', SAMPLE_TOKENS)

      const context = await manager.resolveForAgent('trend-scout', {
        credentials: ['reddit'],
      })

      // JSON.stringify on a Map returns "{}" — token values never leak
      const serialized = JSON.stringify(context)
      expect(serialized).not.toContain(SAMPLE_TOKENS.accessToken)
      expect(serialized).not.toContain(SAMPLE_TOKENS.refreshToken)
    })
  })

  describe('resolveForAgent() error handling', () => {
    it('throws CredentialStoreError when keychain data is corrupted', async () => {
      // Store valid token first, then corrupt the keychain data
      await manager.store('reddit', SAMPLE_TOKENS, ['read'])
      keychain.store.set('reddit', '{"bad": "data"}')

      await expect(
        manager.resolveForAgent('trend-scout', { credentials: ['reddit'] }),
      ).rejects.toThrow(CredentialStoreError)
    })
  })

  describe('TrustViolationError', () => {
    it('formats message with agent name, attempted credential, and declared list', () => {
      const err = new TrustViolationError('trend-scout', 'facebook', ['reddit', 'tiktok'])

      expect(err.code).toBe('CREDENTIAL_TRUST_VIOLATION')
      expect(err.source).toBe('credentials')
      expect(err.severity).toBe('permanent')
      expect(err.message).toContain('trend-scout')
      expect(err.message).toContain('facebook')
      expect(err.message).toContain('reddit, tiktok')
      expect(err.resolution).toContain('facebook')
    })

    it('handles empty declared credentials list', () => {
      const err = new TrustViolationError('rogue-agent', 'reddit', [])

      expect(err.message).toContain('declares: []')
      expect(err.resolution).toContain('reddit')
    })
  })

  describe('CredentialAccessDeniedError', () => {
    it('formats message with agent name and trust tier', () => {
      const err = new CredentialAccessDeniedError('community-agent', 'community')

      expect(err.code).toBe('CREDENTIAL_ACCESS_DENIED')
      expect(err.source).toBe('credentials')
      expect(err.severity).toBe('permanent')
      expect(err.message).toContain('community-agent')
      expect(err.message).toContain('community')
      expect(err.resolution).toContain('community-agent')
      expect(err.resolution).toContain('verified')
    })
  })

  describe('integration: full credential isolation flow', () => {
    it('store → resolveForAgent → scoped access → no log exposure', async () => {
      const { scrubCredentials } = await import('../../../src/lib/credentials/credential-scrubber.js')

      // Store multiple platform tokens
      const redditTokens: TokenData = {
        accessToken: 'reddit-access-secret-12345',
        refreshToken: 'reddit-refresh-secret-67890',
        expiresAt: '2026-04-01T00:00:00Z',
      }
      const tiktokTokens: TokenData = {
        accessToken: 'tiktok-access-secret-abcde',
        refreshToken: 'tiktok-refresh-secret-fghij',
        expiresAt: '2026-04-01T00:00:00Z',
      }
      const fbTokens: TokenData = {
        accessToken: 'fb-access-secret-vwxyz',
        refreshToken: 'fb-refresh-secret-11111',
        expiresAt: '2026-04-01T00:00:00Z',
      }

      await manager.store('reddit', redditTokens, ['read'])
      await manager.store('tiktok', tiktokTokens, ['video.list'])
      await manager.store('facebook', fbTokens, ['pages_manage_posts'])

      // Resolve scoped context for an agent that only needs reddit
      const context = await manager.resolveForAgent('trend-scout', {
        credentials: ['reddit'],
      })

      // AC1: Only declared credential accessible
      expect(context.size).toBe(1)
      expect(context.get('reddit')).toBe('reddit-access-secret-12345')
      expect(context.has('tiktok')).toBe(false)
      expect(context.has('facebook')).toBe(false)

      // AC2: Scrubber removes tokens from log output
      const logLine = `Agent trend-scout posted with token reddit-access-secret-12345 to /api/v1`
      const scrubbed = scrubCredentials(logLine, context)
      expect(scrubbed).not.toContain('reddit-access-secret-12345')
      expect(scrubbed).toContain('[REDACTED:reddit]')

      // AC2: JSON.stringify doesn't leak tokens
      const serialized = JSON.stringify({ context, log: scrubbed })
      expect(serialized).not.toContain('reddit-access-secret-12345')
      expect(serialized).not.toContain('tiktok-access-secret-abcde')
      expect(serialized).not.toContain('fb-access-secret-vwxyz')

      // AC3: Agent with no permissions gets empty context
      const emptyContext = await manager.resolveForAgent('analyzer')
      expect(emptyContext.size).toBe(0)
    })
  })
})
