import {describe, it, expect, vi, beforeEach} from 'vitest'

import {
  buildBasicAuthHeader,
  buildUserAgent,
  buildRedditAuthorizationUrl,
  isTokenExpiringSoon,
  exchangeRedditCode,
  refreshRedditToken,
  revokeRedditToken,
} from '../../../../src/lib/platforms/reddit/reddit-auth.js'
import {RedditAuthError, RedditTokenRefreshError} from '../../../../src/lib/platforms/reddit/errors.js'

describe('reddit-auth', () => {
  describe('buildBasicAuthHeader', () => {
    it('encodes client_id:client_secret in base64', () => {
      const header = buildBasicAuthHeader('my-client-id', 'my-client-secret')
      const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString()
      expect(decoded).toBe('my-client-id:my-client-secret')
      expect(header).toMatch(/^Basic /)
    })

    it('handles special characters in credentials', () => {
      const header = buildBasicAuthHeader('id+special=', 'secret/with+chars')
      const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString()
      expect(decoded).toBe('id+special=:secret/with+chars')
    })
  })

  describe('buildUserAgent', () => {
    it('builds user agent with version and username', () => {
      const ua = buildUserAgent('v1.0.0', 'testuser')
      expect(ua).toBe('linux:marketing-agent-teams:v1.0.0 (by /u/testuser)')
    })

    it('uses default username when not provided', () => {
      const ua = buildUserAgent('v2.0.0')
      expect(ua).toBe('linux:marketing-agent-teams:v2.0.0 (by /u/marketing-agent-teams)')
    })
  })

  describe('buildRedditAuthorizationUrl', () => {
    it('builds URL with duration=permanent', () => {
      const url = buildRedditAuthorizationUrl('client123', 'http://localhost:3000/callback', 'state-abc', ['identity', 'read', 'submit', 'flair'])
      expect(url).toContain('duration=permanent')
      expect(url).toContain('client_id=client123')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('state=state-abc')
      expect(url).toContain('scope=identity%2Cread%2Csubmit%2Cflair')
      expect(url).toContain('response_type=code')
      expect(url.startsWith('https://www.reddit.com/api/v1/authorize?')).toBe(true)
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('returns true when token expires in less than 5 minutes', () => {
      const soon = new Date(Date.now() + 2 * 60 * 1000).toISOString()
      expect(isTokenExpiringSoon(soon)).toBe(true)
    })

    it('returns true when token is already expired', () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString()
      expect(isTokenExpiringSoon(past)).toBe(true)
    })

    it('returns false when token has more than 5 minutes remaining', () => {
      const future = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      expect(isTokenExpiringSoon(future)).toBe(false)
    })

    it('returns true at exactly 5 minutes boundary', () => {
      const exact = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      expect(isTokenExpiringSoon(exact)).toBe(true)
    })
  })

  describe('exchangeRedditCode', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('exchanges code for tokens using Basic Auth', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

      const tokens = await exchangeRedditCode('auth-code', 'http://localhost:3000/callback', 'client-id', 'client-secret', 'test-ua')

      expect(tokens.accessToken).toBe('access-123')
      expect(tokens.refreshToken).toBe('refresh-456')
      expect(tokens.expiresAt).toBeTruthy()

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe('https://www.reddit.com/api/v1/access_token')
      const headers = fetchCall[1]?.headers as Record<string, string>
      expect(headers['Authorization']).toMatch(/^Basic /)
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      expect(headers['User-Agent']).toBe('test-ua')
    })

    it('throws RedditAuthError on HTTP failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request'),
        statusText: 'Bad Request',
      } as unknown as Response)

      await expect(
        exchangeRedditCode('bad-code', 'http://localhost:3000/callback', 'client-id', 'secret', 'ua'),
      ).rejects.toThrow(RedditAuthError)
    })

    it('throws RedditAuthError on error in response body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({error: 'invalid_grant'}),
      } as unknown as Response)

      await expect(
        exchangeRedditCode('bad-code', 'http://localhost:3000/callback', 'client-id', 'secret', 'ua'),
      ).rejects.toThrow(RedditAuthError)
    })
  })

  describe('refreshRedditToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('refreshes token and keeps same refresh token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      } as unknown as Response)

      const tokens = await refreshRedditToken('old-refresh', 'client-id', 'secret', 'ua')
      expect(tokens.accessToken).toBe('new-access-token')
      expect(tokens.refreshToken).toBe('old-refresh') // Same refresh token
      expect(tokens.expiresAt).toBeTruthy()

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!
      const body = fetchCall[1]?.body as URLSearchParams
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('old-refresh')
    })

    it('throws RedditTokenRefreshError on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
        statusText: 'Unauthorized',
      } as unknown as Response)

      await expect(
        refreshRedditToken('bad-refresh', 'client-id', 'secret', 'ua'),
      ).rejects.toThrow(RedditTokenRefreshError)
    })
  })

  describe('revokeRedditToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('revokes a token successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
      } as unknown as Response)

      await expect(
        revokeRedditToken('token-to-revoke', 'refresh_token', 'client-id', 'secret', 'ua'),
      ).resolves.toBeUndefined()

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe('https://www.reddit.com/api/v1/revoke_token')
      const body = fetchCall[1]?.body as URLSearchParams
      expect(body.get('token')).toBe('token-to-revoke')
      expect(body.get('token_type_hint')).toBe('refresh_token')
    })

    it('throws on non-ok, non-204 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server Error'),
        statusText: 'Server Error',
      } as unknown as Response)

      await expect(
        revokeRedditToken('token', 'refresh_token', 'client-id', 'secret', 'ua'),
      ).rejects.toThrow(RedditAuthError)
    })
  })
})
