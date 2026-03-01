import {describe, it, expect, vi} from 'vitest'

import {
  buildInstagramAuthorizationUrl,
  exchangeInstagramCode,
  exchangeForLongLivedToken,
  getPageAccessTokens,
  discoverInstagramAccount,
  discoverAllInstagramAccounts,
  getInstagramScopes,
} from '../../../../src/lib/platforms/instagram/instagram-auth.js'
import {InstagramAuthError, InstagramAccountDiscoveryError} from '../../../../src/lib/platforms/instagram/errors.js'

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

describe('Instagram Auth', () => {
  describe('getInstagramScopes', () => {
    it('returns the correct Instagram scopes', () => {
      const scopes = getInstagramScopes()
      expect(scopes).toEqual([
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
      ])
    })

    it('returns a new array each time (no mutation leaks)', () => {
      const a = getInstagramScopes()
      const b = getInstagramScopes()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })
  })

  describe('buildInstagramAuthorizationUrl', () => {
    it('builds correct authorization URL with Instagram scopes', () => {
      const url = buildInstagramAuthorizationUrl(
        'test-client-id',
        'http://localhost:3000/callback',
        'random-state',
      )

      expect(url).toContain('https://www.facebook.com/v24.0/dialog/oauth')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('state=random-state')
      expect(url).toContain('scope=instagram_basic')
      expect(url).toContain('instagram_content_publish')
      expect(url).toContain('pages_show_list')
      expect(url).toContain('pages_read_engagement')
      expect(url).toContain('response_type=code')
    })

    it('includes redirect_uri', () => {
      const url = buildInstagramAuthorizationUrl(
        'id',
        'http://localhost:8080/cb',
        'state',
      )

      expect(url).toContain(encodeURIComponent('http://localhost:8080/cb'))
    })

    it('accepts custom scopes', () => {
      const url = buildInstagramAuthorizationUrl(
        'id',
        'http://localhost/cb',
        'state',
        ['custom_scope'],
      )

      expect(url).toContain('scope=custom_scope')
    })
  })

  describe('exchangeInstagramCode', () => {
    it('exchanges authorization code for short-lived token', async () => {
      const fetchFn = mockFetch({access_token: 'short-lived-token-abc', token_type: 'bearer', expires_in: 3600})

      const token = await exchangeInstagramCode('auth-code', 'http://localhost/cb', 'client-id', 'client-secret', fetchFn)

      expect(token).toBe('short-lived-token-abc')
      expect(fetchFn).toHaveBeenCalledOnce()
      const calledUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('graph.facebook.com/v24.0/oauth/access_token')
      expect(calledUrl).toContain('code=auth-code')
    })

    it('throws InstagramAuthError on HTTP failure', async () => {
      const fetchFn = mockFetch('Unauthorized', false, 401)

      await expect(
        exchangeInstagramCode('bad-code', 'http://localhost/cb', 'client-id', 'secret', fetchFn),
      ).rejects.toThrow(InstagramAuthError)
    })

    it('throws InstagramAuthError on invalid response', async () => {
      const fetchFn = mockFetch({invalid: 'response'})

      await expect(
        exchangeInstagramCode('code', 'http://localhost/cb', 'client-id', 'secret', fetchFn),
      ).rejects.toThrow(InstagramAuthError)
    })
  })

  describe('exchangeForLongLivedToken', () => {
    it('exchanges short-lived token for long-lived token', async () => {
      const fetchFn = mockFetch({access_token: 'long-lived-token-xyz', token_type: 'bearer', expires_in: 5_184_000})

      const result = await exchangeForLongLivedToken('short-token', 'client-id', 'client-secret', fetchFn)

      expect(result.accessToken).toBe('long-lived-token-xyz')
      expect(result.expiresIn).toBe(5_184_000)
      const calledUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('grant_type=fb_exchange_token')
      expect(calledUrl).toContain('fb_exchange_token=short-token')
    })

    it('defaults expires_in to 60 days when not provided', async () => {
      const fetchFn = mockFetch({access_token: 'long-token'})

      const result = await exchangeForLongLivedToken('short-token', 'id', 'secret', fetchFn)

      expect(result.expiresIn).toBe(5_184_000)
    })

    it('throws InstagramAuthError on HTTP failure', async () => {
      const fetchFn = mockFetch('Server error', false, 500)

      await expect(
        exchangeForLongLivedToken('token', 'id', 'secret', fetchFn),
      ).rejects.toThrow(InstagramAuthError)
    })

    it('throws InstagramAuthError on invalid response', async () => {
      const fetchFn = mockFetch({no_token: true})

      await expect(
        exchangeForLongLivedToken('token', 'id', 'secret', fetchFn),
      ).rejects.toThrow(InstagramAuthError)
    })
  })

  describe('getPageAccessTokens', () => {
    it('returns Pages from /me/accounts', async () => {
      const fetchFn = mockFetch({
        data: [
          {id: '111', name: 'Page One', access_token: 'page-token-1'},
          {id: '222', name: 'Page Two', access_token: 'page-token-2'},
        ],
      })

      const pages = await getPageAccessTokens('long-lived-token', fetchFn)

      expect(pages).toHaveLength(2)
      expect(pages[0]!.id).toBe('111')
      expect(pages[0]!.name).toBe('Page One')
      expect(pages[1]!.access_token).toBe('page-token-2')
    })

    it('throws InstagramAuthError on HTTP failure', async () => {
      const fetchFn = mockFetch('Forbidden', false, 403)

      await expect(
        getPageAccessTokens('bad-token', fetchFn),
      ).rejects.toThrow(InstagramAuthError)
    })

    it('throws InstagramAuthError on invalid response', async () => {
      const fetchFn = mockFetch({not_data: []})

      await expect(
        getPageAccessTokens('token', fetchFn),
      ).rejects.toThrow(InstagramAuthError)
    })
  })

  describe('discoverInstagramAccount', () => {
    it('returns Instagram User ID when linked Business account exists', async () => {
      const fetchFn = mockFetch({
        id: '111',
        instagram_business_account: {id: '17841401234567890'},
      })

      const igUserId = await discoverInstagramAccount('111', 'page-token', fetchFn)

      expect(igUserId).toBe('17841401234567890')
      const calledUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('/111')
      expect(calledUrl).toContain('fields=instagram_business_account')
    })

    it('returns null when no Instagram account is linked', async () => {
      const fetchFn = mockFetch({id: '111'})

      const igUserId = await discoverInstagramAccount('111', 'page-token', fetchFn)

      expect(igUserId).toBeNull()
    })

    it('throws InstagramAccountDiscoveryError on HTTP failure', async () => {
      const fetchFn = mockFetch('Error', false, 500)

      await expect(
        discoverInstagramAccount('111', 'page-token', fetchFn),
      ).rejects.toThrow(InstagramAccountDiscoveryError)
    })

    it('returns null on invalid/unparseable response', async () => {
      const fetchFn = mockFetch({unexpected: 'data'})

      const igUserId = await discoverInstagramAccount('111', 'page-token', fetchFn)

      // The schema requires 'id' field, so safeParse fails → null
      expect(igUserId).toBeNull()
    })
  })

  describe('discoverAllInstagramAccounts', () => {
    it('discovers Instagram accounts across multiple Pages', async () => {
      const pages = [
        {id: '111', name: 'Page A', access_token: 'token-a'},
        {id: '222', name: 'Page B', access_token: 'token-b'},
        {id: '333', name: 'Page C (no IG)', access_token: 'token-c'},
      ]

      let callCount = 0
      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            ok: true, status: 200,
            json: vi.fn().mockResolvedValue({id: '111', instagram_business_account: {id: 'ig-111'}}),
            text: vi.fn().mockResolvedValue(''),
            headers: new Headers(),
          }
        }
        if (callCount === 2) {
          return {
            ok: true, status: 200,
            json: vi.fn().mockResolvedValue({id: '222', instagram_business_account: {id: 'ig-222'}}),
            text: vi.fn().mockResolvedValue(''),
            headers: new Headers(),
          }
        }
        return {
          ok: true, status: 200,
          json: vi.fn().mockResolvedValue({id: '333'}),
          text: vi.fn().mockResolvedValue(''),
          headers: new Headers(),
        }
      })

      const accounts = await discoverAllInstagramAccounts(pages, fetchFn)

      expect(accounts).toHaveLength(2)
      expect(accounts[0]).toEqual({
        igUserId: 'ig-111',
        pageId: '111',
        pageAccessToken: 'token-a',
        pageName: 'Page A',
      })
      expect(accounts[1]!.igUserId).toBe('ig-222')
    })

    it('returns empty array when no Pages have Instagram accounts', async () => {
      const pages = [{id: '111', name: 'Page A', access_token: 'token-a'}]
      const fetchFn = mockFetch({id: '111'})

      const accounts = await discoverAllInstagramAccounts(pages, fetchFn)

      expect(accounts).toHaveLength(0)
    })

    it('returns empty array for empty pages list', async () => {
      const fetchFn = vi.fn()

      const accounts = await discoverAllInstagramAccounts([], fetchFn)

      expect(accounts).toHaveLength(0)
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })
})
