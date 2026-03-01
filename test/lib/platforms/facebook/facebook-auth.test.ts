import {describe, it, expect, vi} from 'vitest'

import {
  buildFacebookAuthorizationUrl,
  exchangeFacebookCode,
  exchangeForLongLivedToken,
  getPageAccessTokens,
  executeFacebookTokenChain,
} from '../../../../src/lib/platforms/facebook/facebook-auth.js'
import {FacebookAuthError, FacebookTokenExchangeError} from '../../../../src/lib/platforms/facebook/errors.js'

// --- Helpers ---

function mockFetch(data: unknown, ok = true, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    headers: new Headers(),
  })
}

// --- Tests ---

describe('Facebook Auth', () => {
  describe('buildFacebookAuthorizationUrl', () => {
    it('builds correct authorization URL with scopes', () => {
      const url = buildFacebookAuthorizationUrl(
        'test-client-id',
        'http://localhost:3000/callback',
        'random-state',
        ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
      )

      expect(url).toContain('https://www.facebook.com/v24.0/dialog/oauth')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('state=random-state')
      expect(url).toContain('scope=pages_manage_posts%2Cpages_read_engagement%2Cpages_show_list')
      expect(url).toContain('response_type=code')
    })

    it('includes redirect_uri', () => {
      const url = buildFacebookAuthorizationUrl(
        'id',
        'http://localhost:8080/cb',
        'state',
        ['pages_manage_posts'],
      )

      expect(url).toContain(encodeURIComponent('http://localhost:8080/cb'))
    })
  })

  describe('exchangeFacebookCode', () => {
    it('exchanges authorization code for short-lived token', async () => {
      const fetchFn = mockFetch({access_token: 'short-lived-token-abc', token_type: 'bearer', expires_in: 3600})

      const token = await exchangeFacebookCode('auth-code', 'http://localhost/cb', 'client-id', 'client-secret', fetchFn)

      expect(token).toBe('short-lived-token-abc')
      expect(fetchFn).toHaveBeenCalledOnce()
      const calledUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('graph.facebook.com/v24.0/oauth/access_token')
      expect(calledUrl).toContain('code=auth-code')
    })

    it('throws FacebookAuthError on HTTP failure', async () => {
      const fetchFn = mockFetch('Unauthorized', false, 401)

      await expect(
        exchangeFacebookCode('bad-code', 'http://localhost/cb', 'client-id', 'secret', fetchFn),
      ).rejects.toThrow(FacebookAuthError)
    })

    it('throws FacebookAuthError on invalid response', async () => {
      const fetchFn = mockFetch({invalid: 'response'})

      await expect(
        exchangeFacebookCode('code', 'http://localhost/cb', 'client-id', 'secret', fetchFn),
      ).rejects.toThrow(FacebookAuthError)
    })
  })

  describe('exchangeForLongLivedToken', () => {
    it('exchanges short-lived token for long-lived token', async () => {
      const fetchFn = mockFetch({access_token: 'long-lived-token-xyz', token_type: 'bearer', expires_in: 5_184_000})

      const result = await exchangeForLongLivedToken('short-token', 'client-id', 'client-secret', fetchFn)

      expect(result.accessToken).toBe('long-lived-token-xyz')
      expect(result.expiresIn).toBe(5_184_000) // 60 days
      const calledUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('grant_type=fb_exchange_token')
      expect(calledUrl).toContain('fb_exchange_token=short-token')
    })

    it('defaults expires_in to 60 days when not provided', async () => {
      const fetchFn = mockFetch({access_token: 'long-token'})

      const result = await exchangeForLongLivedToken('short-token', 'id', 'secret', fetchFn)

      expect(result.expiresIn).toBe(5_184_000)
    })

    it('throws FacebookTokenExchangeError on failure', async () => {
      const fetchFn = mockFetch('Bad Request', false, 400)

      await expect(
        exchangeForLongLivedToken('bad-token', 'id', 'secret', fetchFn),
      ).rejects.toThrow(FacebookTokenExchangeError)
    })
  })

  describe('getPageAccessTokens', () => {
    it('retrieves Page tokens from /me/accounts', async () => {
      const fetchFn = mockFetch({
        data: [
          {id: '111', name: 'Page A', access_token: 'token-a'},
          {id: '222', name: 'Page B', access_token: 'token-b'},
        ],
      })

      const pages = await getPageAccessTokens('long-lived-token', fetchFn)

      expect(pages).toHaveLength(2)
      expect(pages[0]!.id).toBe('111')
      expect(pages[0]!.name).toBe('Page A')
      expect(pages[0]!.access_token).toBe('token-a')
      expect(pages[1]!.id).toBe('222')
    })

    it('returns empty array for users with no Pages', async () => {
      const fetchFn = mockFetch({data: []})

      const pages = await getPageAccessTokens('token', fetchFn)

      expect(pages).toHaveLength(0)
    })

    it('throws on HTTP failure', async () => {
      const fetchFn = mockFetch('Server Error', false, 500)

      await expect(getPageAccessTokens('token', fetchFn)).rejects.toThrow(FacebookTokenExchangeError)
    })
  })

  describe('executeFacebookTokenChain', () => {
    it('executes full token chain: code → short → long → page', async () => {
      let callIndex = 0
      const fetchFn = vi.fn().mockImplementation(async (url: string) => {
        callIndex++

        // Call 1: exchangeFacebookCode (authorization code → short-lived token)
        if (callIndex === 1) {
          expect(url).toContain('oauth/access_token')
          expect(url).toContain('code=auth-code')
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({access_token: 'short-lived', expires_in: 3600}),
            text: vi.fn().mockResolvedValue(''),
            headers: new Headers(),
          }
        }

        // Call 2: exchangeForLongLivedToken (short → long-lived)
        if (callIndex === 2) {
          expect(url).toContain('grant_type=fb_exchange_token')
          expect(url).toContain('fb_exchange_token=short-lived')
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({access_token: 'long-lived', expires_in: 5_184_000}),
            text: vi.fn().mockResolvedValue(''),
            headers: new Headers(),
          }
        }

        // Call 3: getPageAccessTokens (long-lived → page tokens)
        if (callIndex === 3) {
          expect(url).toContain('/me/accounts')
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
              data: [{id: 'page-123', name: 'My Page', access_token: 'page-token-never-expires'}],
            }),
            text: vi.fn().mockResolvedValue(''),
            headers: new Headers(),
          }
        }

        return {ok: false, status: 500, json: vi.fn(), text: vi.fn().mockResolvedValue(''), headers: new Headers()}
      }) as typeof globalThis.fetch

      const tokenData = await executeFacebookTokenChain(
        'auth-code',
        'http://localhost/cb',
        'client-id',
        'client-secret',
        'page-123',
        fetchFn,
      )

      expect(callIndex).toBe(3) // 3 API calls in the chain
      expect(tokenData.accessToken).toBe('page-token-never-expires')
      expect(tokenData.refreshToken).toBe('') // Page tokens don't refresh
    })

    it('throws if selected page not found', async () => {
      let callIndex = 0
      const fetchFn = vi.fn().mockImplementation(async () => {
        callIndex++
        if (callIndex === 1) {
          return {ok: true, status: 200, json: vi.fn().mockResolvedValue({access_token: 'short'}), headers: new Headers()}
        }
        if (callIndex === 2) {
          return {ok: true, status: 200, json: vi.fn().mockResolvedValue({access_token: 'long', expires_in: 5_184_000}), headers: new Headers()}
        }
        return {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({data: [{id: 'other-page', name: 'Other', access_token: 'tok'}]}),
          headers: new Headers(),
        }
      }) as typeof globalThis.fetch

      await expect(
        executeFacebookTokenChain('code', 'http://localhost/cb', 'id', 'secret', 'missing-page', fetchFn),
      ).rejects.toThrow(FacebookTokenExchangeError)
    })
  })
})
