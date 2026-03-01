import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {RedditAdapter} from '../../../../src/lib/platforms/reddit/reddit-adapter.js'
import {classifyHttpStatus, classifyRedditErrorCode} from '../../../../src/lib/platforms/reddit/errors.js'
import type {PlatformContent} from '../../../../src/lib/platforms/types.js'
import type {KeychainAdapter, TokenData} from '../../../../src/lib/credentials/types.js'
import {CredentialManager} from '../../../../src/lib/credentials/credential-manager.js'
import {createTestDir, removeTestDir} from '../../../helpers/test-project.js'

// --- Helpers ---

function createMockKeychain(): KeychainAdapter {
  const store = new Map<string, string>()
  return {
    setPassword: vi.fn(async (_svc: string, acct: string, pw: string) => {
      store.set(acct, pw)
    }),
    getPassword: vi.fn(async (_svc: string, acct: string) => store.get(acct) ?? null),
    deletePassword: vi.fn(async (_svc: string, acct: string) => store.delete(acct)),
  }
}

const VALID_TOKENS: TokenData = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
}

function makeContent(overrides: Partial<PlatformContent['content']> = {}, meta: Record<string, unknown> = {}): PlatformContent {
  return {
    itemId: 'item-001',
    platform: 'reddit',
    content: {
      title: 'Test Post Title',
      body: 'This is a test post body with enough content for Reddit.',
      hashtags: [],
      platformMeta: {subreddit: 'marketing', ...meta},
      ...overrides,
    },
  }
}

function mockFetch(response: Partial<Response> & {json?: () => Promise<unknown>; text?: () => Promise<string>; headers?: Headers}): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    ...response,
  })
}

const FIXTURE_DIR = join(import.meta.dirname, '../../../fixtures/responses')

async function loadFixture(name: string): Promise<unknown> {
  const content = await readFile(join(FIXTURE_DIR, name), 'utf-8')
  return JSON.parse(content)
}

// --- Tests ---

describe('RedditAdapter', () => {
  let testDir: string
  let keychain: KeychainAdapter
  let credManager: CredentialManager
  let adapter: RedditAdapter

  beforeEach(async () => {
    vi.restoreAllMocks()
    testDir = await createTestDir()
    keychain = createMockKeychain()
    credManager = new CredentialManager(keychain, testDir)

    // Store valid tokens
    await credManager.store('reddit', VALID_TOKENS, ['identity', 'read', 'submit', 'flair'])

    // Set env vars for OAuth config
    process.env['MAT_REDDIT_CLIENT_ID'] = 'test-client-id'
    process.env['MAT_REDDIT_CLIENT_SECRET'] = 'test-client-secret'
  })

  afterEach(async () => {
    await removeTestDir(testDir)
    delete process.env['MAT_REDDIT_CLIENT_ID']
    delete process.env['MAT_REDDIT_CLIENT_SECRET']
  })

  describe('publish', () => {
    it('publishes a self-post successfully', async () => {
      const fixture = await loadFixture('reddit-submit-success.json')

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture),
          headers: new Headers({
            'x-ratelimit-remaining': '55',
            'x-ratelimit-reset': '60',
            'x-ratelimit-used': '5',
          }),
        }),
      })

      const content = makeContent()
      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(result.platform).toBe('reddit')
      expect(result.postId).toBe('t3_abc123')
      expect(result.postUrl).toContain('reddit.com')
      expect(result.publishedAt).toBeTruthy()
    })

    it('returns failure when subreddit is missing', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({}),
      })

      const content = makeContent({}, {})
      // Remove subreddit
      delete content.content.platformMeta['subreddit']

      const result = await adapter.publish(content)
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('REDDIT_MISSING_SUBREDDIT')
      expect(result.error?.classification).toBe('permanent')
    })

    it('handles Reddit submit errors (RATELIMIT)', async () => {
      const errorFixture = (await loadFixture('reddit-submit-error.json')) as Record<string, unknown>
      const successFixture = await loadFixture('reddit-submit-success.json')
      let attempt = 0

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: vi.fn().mockResolvedValue(errorFixture['rateLimit']),
            text: vi.fn().mockResolvedValue(''),
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue(successFixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const result = await adapter.publish(makeContent())
      // RATELIMIT is transient, retried and then succeeded
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('handles Reddit submit errors (SUBREDDIT_NOTALLOWED)', async () => {
      const fixture = (await loadFixture('reddit-submit-error.json')) as Record<string, unknown>

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture['subredditNotAllowed']),
          headers: new Headers(),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('SUBREDDIT_NOTALLOWED')
      expect(result.error?.classification).toBe('permanent')
    })

    it('handles Reddit submit errors (ALREADY_SUB)', async () => {
      const fixture = (await loadFixture('reddit-submit-error.json')) as Record<string, unknown>

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture['contentPolicy']),
          headers: new Headers(),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('ALREADY_SUB')
      expect(result.error?.classification).toBe('permanent')
    })

    it('maps link post kind correctly', async () => {
      const fixture = await loadFixture('reddit-submit-success.json')
      const fetchFn = mockFetch({
        json: vi.fn().mockResolvedValue(fixture),
        headers: new Headers(),
      })

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const content = makeContent({body: ''}, {kind: 'link', url: 'https://example.com', subreddit: 'test'})
      await adapter.publish(content)

      const call = vi.mocked(fetchFn).mock.calls[0]!
      const body = call[1]?.body as URLSearchParams
      expect(body.get('kind')).toBe('link')
      expect(body.get('url')).toBe('https://example.com')
    })

    it('includes flair_id and nsfw in submit params', async () => {
      const fixture = await loadFixture('reddit-submit-success.json')
      const fetchFn = mockFetch({
        json: vi.fn().mockResolvedValue(fixture),
        headers: new Headers(),
      })

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const content = makeContent({}, {subreddit: 'test', flair_id: 'flair-uuid-1', nsfw: true, spoiler: true})
      await adapter.publish(content)

      const call = vi.mocked(fetchFn).mock.calls[0]!
      const body = call[1]?.body as URLSearchParams
      expect(body.get('flair_id')).toBe('flair-uuid-1')
      expect(body.get('nsfw')).toBe('true')
      expect(body.get('spoiler')).toBe('true')
    })

    it('retries on transient HTTP errors (500)', async () => {
      let attempt = 0
      const fixture = await loadFixture('reddit-submit-success.json')

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            text: vi.fn().mockResolvedValue('Internal Server Error'),
            statusText: 'Internal Server Error',
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue(fixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('returns permanent error on 401', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          ok: false,
          status: 401,
          headers: new Headers(),
          text: vi.fn().mockResolvedValue('Unauthorized'),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.classification).toBe('permanent')
      expect(result.error?.code).toBe('REDDIT_HTTP_401')
    })

    it('returns permanent error on 403', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          ok: false,
          status: 403,
          headers: new Headers(),
          text: vi.fn().mockResolvedValue('Forbidden'),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.classification).toBe('permanent')
    })

    it('retries on 429 rate limit', async () => {
      let attempt = 0
      const fixture = await loadFixture('reddit-submit-success.json')

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1'}),
            text: vi.fn().mockResolvedValue('Too Many Requests'),
            statusText: 'Too Many Requests',
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({'x-ratelimit-remaining': '55'}),
          json: vi.fn().mockResolvedValue(fixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })
  })

  describe('validateContent', () => {
    it('validates title max length (300 chars)', async () => {
      const postReqs = await loadFixture('reddit-post-requirements.json')

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(postReqs),
          headers: new Headers(),
        }),
      })

      const content = makeContent({title: 'x'.repeat(301)})
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'title' && e.constraint === 'maxLength')).toBe(true)
    })

    it('validates missing subreddit', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({headers: new Headers()}),
      })

      const content = makeContent({}, {})
      delete content.content.platformMeta['subreddit']

      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'platformMeta.subreddit')).toBe(true)
    })

    it('validates missing title', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({headers: new Headers()}),
      })

      const content = makeContent({title: undefined})
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'title' && e.constraint === 'required')).toBe(true)
    })

    it('validates body exceeds 40,000 chars', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({headers: new Headers()}),
      })

      const content = makeContent({body: 'x'.repeat(40_001)})
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'body' && e.constraint === 'maxLength')).toBe(true)
    })

    it('checks flair required from subreddit rules', async () => {
      const postReqs = await loadFixture('reddit-post-requirements.json')

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(postReqs),
          headers: new Headers(),
        }),
      })

      const content = makeContent() // No flair_id
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'platformMeta.flair_id' && e.constraint === 'required')).toBe(true)
    })

    it('checks blacklisted strings', async () => {
      const postReqs = await loadFixture('reddit-post-requirements.json')

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(postReqs),
          headers: new Headers(),
        }),
      })

      const content = makeContent({body: 'Check out this spam content!'})
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.constraint === 'blacklisted')).toBe(true)
    })

    it('detects title below subreddit minimum length', async () => {
      const postReqs = await loadFixture('reddit-post-requirements.json')

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(postReqs),
          headers: new Headers(),
        }),
      })

      const content = makeContent({title: 'Short'}) // 5 chars, min is 10
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'title' && e.constraint === 'minLength')).toBe(true)
    })

    it('passes valid content', async () => {
      const postReqs = {
        is_flair_required: false,
        title_text_min_length: 0,
        title_text_max_length: 300,
        body_restriction_policy: 'none',
        body_blacklisted_strings: [],
        domain_blacklist: [],
      }

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(postReqs),
          headers: new Headers(),
        }),
      })

      const content = makeContent()
      const result = await adapter.validateContent(content)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('warns when subreddit rules cannot be fetched', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          ok: false,
          status: 404,
          text: vi.fn().mockResolvedValue('Not Found'),
          headers: new Headers(),
        }),
      })

      const content = makeContent()
      const result = await adapter.validateContent(content)
      // Static validation passes, dynamic failed gracefully
      expect(result.warnings.some((w) => w.field === 'subreddit')).toBe(true)
    })
  })

  describe('error classification', () => {
    it('classifies 429 as transient', async () => {
      let attempt = 0
      const fixture = await loadFixture('reddit-submit-success.json')

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1'}),
            text: vi.fn().mockResolvedValue('Too Many Requests'),
            statusText: 'Too Many Requests',
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue(fixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const result = await adapter.publish(makeContent())
      // 429 is transient, retried, and succeeded
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('classifies 500 as transient', async () => {
      let attempt = 0
      const fixture = await loadFixture('reddit-submit-success.json')

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            text: vi.fn().mockResolvedValue('Internal Server Error'),
            statusText: 'Internal Server Error',
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue(fixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const result = await adapter.publish(makeContent())
      // 500 is transient, retried, and succeeded
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('classifies 502 as transient', async () => {
      let attempt = 0
      const fixture = await loadFixture('reddit-submit-success.json')

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 502,
            headers: new Headers(),
            text: vi.fn().mockResolvedValue('Bad Gateway'),
            statusText: 'Bad Gateway',
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue(fixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn})

      const result = await adapter.publish(makeContent())
      // 502 is transient so it retried and eventually succeeded
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('classifies 401 as permanent', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          ok: false,
          status: 401,
          headers: new Headers(),
          text: vi.fn().mockResolvedValue('Unauthorized'),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.classification).toBe('permanent')
    })

    it('classifies 403 as permanent', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          ok: false,
          status: 403,
          headers: new Headers(),
          text: vi.fn().mockResolvedValue('Forbidden'),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.classification).toBe('permanent')
    })

    it('classifies SUBMIT_VALIDATION_FLAIR_REQUIRED as permanent', async () => {
      const fixture = (await loadFixture('reddit-submit-error.json')) as Record<string, unknown>

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture['flairRequired']),
          headers: new Headers(),
        }),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.classification).toBe('permanent')
    })
  })

  describe('rate limit tracking', () => {
    it('updates rate limits from response headers', async () => {
      const fixture = await loadFixture('reddit-submit-success.json')

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture),
          headers: new Headers({
            'x-ratelimit-remaining': '42',
            'x-ratelimit-reset': '90',
            'x-ratelimit-used': '18',
          }),
        }),
      })

      await adapter.publish(makeContent())

      const limits = await adapter.getRateLimits()
      expect(limits.platform).toBe('reddit')
      expect(limits.remaining).toBe(42)
      expect(limits.limit).toBe(60)
      expect(limits.windowType).toBe('minute')
    })

    it('returns default rate limits when no API call made yet', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({}),
      })

      const limits = await adapter.getRateLimits()
      expect(limits.remaining).toBe(60)
      expect(limits.platform).toBe('reddit')
    })
  })

  describe('getMetrics', () => {
    it('retrieves post metrics', async () => {
      const metricsResponse = {
        data: {
          children: [
            {
              data: {
                score: 42,
                upvote_ratio: 0.95,
                num_comments: 7,
              },
            },
          ],
        },
      }

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(metricsResponse),
          headers: new Headers(),
        }),
      })

      const metrics = await adapter.getMetrics('t3_abc123')
      expect(metrics.postId).toBe('t3_abc123')
      expect(metrics.platform).toBe('reddit')
      expect(metrics.likes).toBe(42)
      expect(metrics.comments).toBe(7)
      expect(metrics.engagementRate).toBe(0.95)
    })

    it('returns empty metrics when post not found', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue({data: {children: []}}),
          headers: new Headers(),
        }),
      })

      const metrics = await adapter.getMetrics('t3_nonexistent')
      expect(metrics.postId).toBe('t3_nonexistent')
      expect(metrics.likes).toBeUndefined()
      expect(metrics.comments).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('revokes tokens and removes from credential manager', async () => {
      const fetchFn = mockFetch({status: 204, ok: true, headers: new Headers()})

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn,
      })

      await adapter.disconnect()

      // Token should be removed
      await expect(credManager.retrieve('reddit')).rejects.toThrow()
    })

    it('removes credentials even if revocation fails', async () => {
      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue('Server Error'),
          headers: new Headers(),
        }),
      })

      await adapter.disconnect()

      // Should still remove local credentials
      await expect(credManager.retrieve('reddit')).rejects.toThrow()
    })
  })

  describe('token refresh', () => {
    it('refreshes token when about to expire', async () => {
      // Store a token that will expire in 2 minutes
      const expiringTokens: TokenData = {
        accessToken: 'old-access',
        refreshToken: 'valid-refresh',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      }
      await credManager.store('reddit', expiringTokens, ['identity', 'read', 'submit', 'flair'])

      const fixture = await loadFixture('reddit-submit-success.json')

      // Mock global fetch for the token refresh call (refreshRedditToken uses global fetch)
      const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      } as unknown as Response)

      // Mock the adapter's fetchFn for the submit call
      const submitFetch = mockFetch({
        json: vi.fn().mockResolvedValue(fixture),
        headers: new Headers(),
      })

      adapter = new RedditAdapter({credentialManager: credManager, fetchFn: submitFetch})

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(true)
      // Global fetch should have been called for refresh
      expect(globalFetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('access_token'),
        expect.any(Object),
      )

      globalFetchSpy.mockRestore()
    })
  })

  describe('authenticate', () => {
    it('returns error when OAuth env vars not set', async () => {
      delete process.env['MAT_REDDIT_CLIENT_ID']
      delete process.env['MAT_REDDIT_CLIENT_SECRET']

      adapter = new RedditAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({}),
      })

      const result = await adapter.authenticate()
      expect(result.success).toBe(false)
      expect(result.error).toContain('MAT_REDDIT_CLIENT_ID')
    })
  })
})

describe('classifyHttpStatus', () => {
  it('classifies 429 as transient', () => {
    expect(classifyHttpStatus(429)).toBe('transient')
  })

  it('classifies 500 as transient', () => {
    expect(classifyHttpStatus(500)).toBe('transient')
  })

  it('classifies 502 as transient', () => {
    expect(classifyHttpStatus(502)).toBe('transient')
  })

  it('classifies 503 as transient', () => {
    expect(classifyHttpStatus(503)).toBe('transient')
  })

  it('classifies 504 as transient', () => {
    expect(classifyHttpStatus(504)).toBe('transient')
  })

  it('classifies 401 as permanent', () => {
    expect(classifyHttpStatus(401)).toBe('permanent')
  })

  it('classifies 403 as permanent', () => {
    expect(classifyHttpStatus(403)).toBe('permanent')
  })

  it('classifies 400 as permanent', () => {
    expect(classifyHttpStatus(400)).toBe('permanent')
  })
})

describe('classifyRedditErrorCode', () => {
  it('classifies RATELIMIT as transient', () => {
    expect(classifyRedditErrorCode('RATELIMIT')).toBe('transient')
  })

  it('classifies SUBMIT_VALIDATION_FLAIR_REQUIRED as permanent', () => {
    expect(classifyRedditErrorCode('SUBMIT_VALIDATION_FLAIR_REQUIRED')).toBe('permanent')
  })

  it('classifies SUBREDDIT_NOTALLOWED as permanent', () => {
    expect(classifyRedditErrorCode('SUBREDDIT_NOTALLOWED')).toBe('permanent')
  })

  it('classifies ALREADY_SUB as permanent', () => {
    expect(classifyRedditErrorCode('ALREADY_SUB')).toBe('permanent')
  })

  it('classifies unknown codes as permanent', () => {
    expect(classifyRedditErrorCode('SOME_UNKNOWN_ERROR')).toBe('permanent')
  })
})
