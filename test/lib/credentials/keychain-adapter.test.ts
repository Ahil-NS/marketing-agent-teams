import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KeychainUnavailableError } from '../../../src/lib/credentials/errors.js'

const mockKeytar = vi.hoisted(() => ({
  setPassword: vi.fn(),
  getPassword: vi.fn(),
  deletePassword: vi.fn(),
}))

vi.mock('keytar', () => ({
  default: mockKeytar,
}))

// Import after mock setup
const { KeytarKeychainAdapter } = await import(
  '../../../src/lib/credentials/keychain-adapter.js'
)

describe('KeytarKeychainAdapter', () => {
  let adapter: InstanceType<typeof KeytarKeychainAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new KeytarKeychainAdapter()
  })

  describe('setPassword()', () => {
    it('delegates to keytar.setPassword', async () => {
      mockKeytar.setPassword.mockResolvedValue(undefined)
      await adapter.setPassword('marketing-agent-teams', 'reddit', '{"accessToken":"abc"}')
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'marketing-agent-teams',
        'reddit',
        '{"accessToken":"abc"}',
      )
    })

    it('throws KeychainUnavailableError when keytar fails', async () => {
      mockKeytar.setPassword.mockRejectedValue(new Error('Keychain daemon not available'))
      await expect(
        adapter.setPassword('marketing-agent-teams', 'reddit', 'data'),
      ).rejects.toThrow(KeychainUnavailableError)
    })
  })

  describe('getPassword()', () => {
    it('returns password string when found', async () => {
      mockKeytar.getPassword.mockResolvedValue('{"accessToken":"abc"}')
      const result = await adapter.getPassword('marketing-agent-teams', 'reddit')
      expect(result).toBe('{"accessToken":"abc"}')
    })

    it('returns null when not found', async () => {
      mockKeytar.getPassword.mockResolvedValue(null)
      const result = await adapter.getPassword('marketing-agent-teams', 'unknown')
      expect(result).toBeNull()
    })

    it('throws KeychainUnavailableError when keytar fails', async () => {
      mockKeytar.getPassword.mockRejectedValue(new Error('Keychain locked'))
      await expect(
        adapter.getPassword('marketing-agent-teams', 'reddit'),
      ).rejects.toThrow(KeychainUnavailableError)
    })
  })

  describe('deletePassword()', () => {
    it('returns true when entry deleted', async () => {
      mockKeytar.deletePassword.mockResolvedValue(true)
      const result = await adapter.deletePassword('marketing-agent-teams', 'reddit')
      expect(result).toBe(true)
    })

    it('returns false when entry not found', async () => {
      mockKeytar.deletePassword.mockResolvedValue(false)
      const result = await adapter.deletePassword('marketing-agent-teams', 'unknown')
      expect(result).toBe(false)
    })

    it('throws KeychainUnavailableError when keytar fails', async () => {
      mockKeytar.deletePassword.mockRejectedValue(new Error('Access denied'))
      await expect(
        adapter.deletePassword('marketing-agent-teams', 'reddit'),
      ).rejects.toThrow(KeychainUnavailableError)
    })
  })
})
