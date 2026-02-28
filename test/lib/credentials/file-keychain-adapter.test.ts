import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { FileKeychainAdapter } from '../../../src/lib/credentials/file-keychain-adapter.js'
import { createTestDir, removeTestDir } from '../../helpers/test-project.js'

describe('FileKeychainAdapter', () => {
  let testDir: string
  let adapter: FileKeychainAdapter

  beforeEach(async () => {
    testDir = await createTestDir()
    adapter = new FileKeychainAdapter(testDir, 'test-passphrase-123')
  })

  afterEach(async () => {
    await removeTestDir(testDir)
  })

  describe('setPassword() + getPassword()', () => {
    it('stores and retrieves encrypted passwords', async () => {
      const data = '{"accessToken":"secret-abc","refreshToken":"secret-xyz"}'
      await adapter.setPassword('svc', 'reddit', data)
      const result = await adapter.getPassword('svc', 'reddit')
      expect(result).toBe(data)
    })

    it('stores multiple accounts independently', async () => {
      await adapter.setPassword('svc', 'reddit', 'reddit-data')
      await adapter.setPassword('svc', 'tiktok', 'tiktok-data')

      expect(await adapter.getPassword('svc', 'reddit')).toBe('reddit-data')
      expect(await adapter.getPassword('svc', 'tiktok')).toBe('tiktok-data')
    })

    it('overwrites existing entry on re-store', async () => {
      await adapter.setPassword('svc', 'reddit', 'old-data')
      await adapter.setPassword('svc', 'reddit', 'new-data')
      expect(await adapter.getPassword('svc', 'reddit')).toBe('new-data')
    })

    it('encrypted file does not contain plaintext tokens', async () => {
      const secret = 'super-secret-token-value'
      await adapter.setPassword('svc', 'reddit', secret)
      const raw = await readFile(join(testDir, '.mat', 'credentials', '.keystore'), 'utf-8')
      expect(raw).not.toContain(secret)
    })
  })

  describe('getPassword()', () => {
    it('returns null for unknown account', async () => {
      expect(await adapter.getPassword('svc', 'unknown')).toBeNull()
    })

    it('fails with wrong passphrase', async () => {
      await adapter.setPassword('svc', 'reddit', 'secret-data')
      const wrongAdapter = new FileKeychainAdapter(testDir, 'wrong-passphrase')
      await expect(wrongAdapter.getPassword('svc', 'reddit')).rejects.toThrow()
    })
  })

  describe('deletePassword()', () => {
    it('returns true and removes entry', async () => {
      await adapter.setPassword('svc', 'reddit', 'data')
      const result = await adapter.deletePassword('svc', 'reddit')
      expect(result).toBe(true)
      expect(await adapter.getPassword('svc', 'reddit')).toBeNull()
    })

    it('returns false for unknown account', async () => {
      expect(await adapter.deletePassword('svc', 'unknown')).toBe(false)
    })
  })
})
