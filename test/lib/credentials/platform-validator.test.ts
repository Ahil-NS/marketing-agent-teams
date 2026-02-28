import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlatformValidator } from '../../../src/lib/credentials/platform-validator.js'
import type { AuthResult } from '../../../src/lib/credentials/types.js'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('PlatformValidator', () => {
  let validator: PlatformValidator

  beforeEach(() => {
    vi.clearAllMocks()
    validator = new PlatformValidator()
  })

  describe('validate()', () => {
    describe('reddit', () => {
      it('returns success when API responds with user data', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ name: 'testuser' }),
        })

        const result = await validator.validate('reddit', 'valid-token')
        expect(result.success).toBe(true)
        expect(result.platform).toBe('reddit')
        expect(mockFetch).toHaveBeenCalledWith(
          'https://oauth.reddit.com/api/v1/me',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer valid-token',
            }),
          }),
        )
      })

      it('returns failure with actionable error on 401', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })

        const result = await validator.validate('reddit', 'bad-token')
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error).toContain('401')
      })

      it('returns failure with actionable error on network error', async () => {
        mockFetch.mockRejectedValue(new Error('Network timeout'))

        const result = await validator.validate('reddit', 'token')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Network timeout')
      })
    })

    describe('tiktok', () => {
      it('returns success when API responds', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ data: { user: { display_name: 'test' } } }),
        })

        const result = await validator.validate('tiktok', 'valid-token')
        expect(result.success).toBe(true)
        expect(result.platform).toBe('tiktok')
      })
    })

    describe('facebook', () => {
      it('returns success when /me endpoint responds', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ id: '12345', name: 'Test User' }),
        })

        const result = await validator.validate('facebook', 'valid-token')
        expect(result.success).toBe(true)
        expect(result.platform).toBe('facebook')
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('graph.facebook.com'),
          expect.any(Object),
        )
      })
    })

    describe('instagram', () => {
      it('returns success when /me endpoint responds', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ id: '67890', username: 'testuser' }),
        })

        const result = await validator.validate('instagram', 'valid-token')
        expect(result.success).toBe(true)
        expect(result.platform).toBe('instagram')
      })
    })
  })

  describe('error messages (NFR27)', () => {
    it('includes what happened in error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
      const result = await validator.validate('reddit', 'token')
      expect(result.error).toBeTruthy()
    })

    it('never exposes token in error message', async () => {
      const sensitiveToken = 'super-secret-token-value'
      mockFetch.mockRejectedValue(new Error('Connection failed'))
      const result = await validator.validate('reddit', sensitiveToken)
      expect(result.error).not.toContain(sensitiveToken)
    })
  })
})
