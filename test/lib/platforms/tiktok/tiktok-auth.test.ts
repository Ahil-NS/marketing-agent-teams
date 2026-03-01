import {describe, it, expect, vi} from 'vitest'

import {
  buildTikTokAuthorizationUrl,
  exchangeTikTokCode,
  isTokenExpiringSoon,
  refreshTikTokToken,
  revokeTikTokToken,
} from '../../../../src/lib/platforms/tiktok/tiktok-auth.js'
import {TikTokAuthError, TikTokTokenRefreshError} from '../../../../src/lib/platforms/tiktok/errors.js'

// --- Helpers ---

function mockFetch(response: {ok: boolean; status: number; json?: () => Promise<unknown>; text?: () => Promise<string>}): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    statusText: 'OK',
    json: response.json ?? vi.fn().mockResolvedValue({}),
    text: response.text ?? vi.fn().mockResolvedValue(''),
  })
}

const VALID_TOKEN_RESPONSE = {
  access_token: 'act.test-access-token',
  expires_in: 86400,
  open_id: 'open_id_12345',
  refresh_expires_in: 31536000,
  refresh_token: 'rft.test-refresh-token',
  scope: 'video.publish,user.info.basic',
  token_type: 'Bearer',
}

describe('TikTok Auth', () => {
  describe('buildTikTokAuthorizationUrl', () => {
    it('builds authorization URL with client_key and comma-separated scopes', () => {
      const url = buildTikTokAuthorizationUrl(
        'test-client-key',
        'http://localhost:3000/callback',
        'random-state',
        ['video.publish', 'user.info.basic'],
      )

      expect(url).toContain('https://www.tiktok.com/v2/auth/authorize/')
      expect(url).toContain('client_key=test-client-key')
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=video.publish%2Cuser.info.basic')
      expect(url).toContain('state=random-state')
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback')
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('returns false when token has more than 5 minutes remaining', () => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
      expect(isTokenExpiringSoon(expiresAt)).toBe(false)
    })

    it('returns true when token has less than 5 minutes remaining', () => {
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString() // 2 min
      expect(isTokenExpiringSoon(expiresAt)).toBe(true)
    })

    it('returns true when token has already expired', () => {
      const expiresAt = new Date(Date.now() - 60 * 1000).toISOString()
      expect(isTokenExpiringSoon(expiresAt)).toBe(true)
    })
  })

  describe('exchangeTikTokCode', () => {
    it('exchanges code for tokens using form-urlencoded', async () => {
      const fetchFn = mockFetch({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(VALID_TOKEN_RESPONSE),
      })

      const result = await exchangeTikTokCode(
        'auth-code-123',
        'http://localhost:3000/callback',
        'client-key',
        'client-secret',
        fetchFn,
      )

      expect(result.accessToken).toBe('act.test-access-token')
      expect(result.refreshToken).toBe('rft.test-refresh-token')
      expect(result.openId).toBe('open_id_12345')
      expect(result.expiresAt).toBeDefined()

      // Verify form-urlencoded body
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(call[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      const body = call[1].body as URLSearchParams
      expect(body.get('client_key')).toBe('client-key')
      expect(body.get('client_secret')).toBe('client-secret')
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('code')).toBe('auth-code-123')
    })

    it('throws TikTokAuthError on HTTP failure', async () => {
      const fetchFn = mockFetch({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request'),
      })

      await expect(
        exchangeTikTokCode('bad-code', 'http://localhost/cb', 'ck', 'cs', fetchFn),
      ).rejects.toThrow(TikTokAuthError)
    })

    it('throws TikTokAuthError on empty access token', async () => {
      const fetchFn = mockFetch({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({...VALID_TOKEN_RESPONSE, access_token: ''}),
      })

      await expect(
        exchangeTikTokCode('code', 'http://localhost/cb', 'ck', 'cs', fetchFn),
      ).rejects.toThrow(TikTokAuthError)
    })

    it('throws TikTokAuthError on invalid response schema', async () => {
      const fetchFn = mockFetch({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({invalid: 'data'}),
      })

      await expect(
        exchangeTikTokCode('code', 'http://localhost/cb', 'ck', 'cs', fetchFn),
      ).rejects.toThrow(TikTokAuthError)
    })
  })

  describe('refreshTikTokToken', () => {
    it('refreshes token and returns potentially rotated refresh token', async () => {
      const newRefreshToken = 'rft.new-rotated-refresh-token'
      const fetchFn = mockFetch({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          ...VALID_TOKEN_RESPONSE,
          access_token: 'act.new-access',
          refresh_token: newRefreshToken,
        }),
      })

      const result = await refreshTikTokToken(
        'rft.old-refresh-token',
        'client-key',
        'client-secret',
        fetchFn,
      )

      expect(result.accessToken).toBe('act.new-access')
      expect(result.refreshToken).toBe(newRefreshToken)
      expect(result.expiresAt).toBeDefined()

      // Verify grant_type=refresh_token
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      const body = call[1].body as URLSearchParams
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('rft.old-refresh-token')
    })

    it('throws TikTokTokenRefreshError on HTTP failure', async () => {
      const fetchFn = mockFetch({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      })

      await expect(
        refreshTikTokToken('rft.expired', 'ck', 'cs', fetchFn),
      ).rejects.toThrow(TikTokTokenRefreshError)
    })

    it('throws TikTokTokenRefreshError on invalid response', async () => {
      const fetchFn = mockFetch({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({garbage: true}),
      })

      await expect(
        refreshTikTokToken('rft.x', 'ck', 'cs', fetchFn),
      ).rejects.toThrow(TikTokTokenRefreshError)
    })
  })

  describe('revokeTikTokToken', () => {
    it('revokes token successfully', async () => {
      const fetchFn = mockFetch({ok: true, status: 200})

      await expect(
        revokeTikTokToken('act.token', 'ck', 'cs', fetchFn),
      ).resolves.toBeUndefined()

      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      const body = call[1].body as URLSearchParams
      expect(body.get('token')).toBe('act.token')
      expect(body.get('client_key')).toBe('ck')
      expect(body.get('client_secret')).toBe('cs')
    })

    it('throws TikTokAuthError on failure', async () => {
      const fetchFn = mockFetch({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal error'),
      })

      await expect(
        revokeTikTokToken('act.token', 'ck', 'cs', fetchFn),
      ).rejects.toThrow(TikTokAuthError)
    })
  })
})
