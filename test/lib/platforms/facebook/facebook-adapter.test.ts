import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {FacebookAdapter} from '../../../../src/lib/platforms/facebook/facebook-adapter.js'
import {classifyFacebookErrorCode, classifyHttpStatus} from '../../../../src/lib/platforms/facebook/errors.js'
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
  accessToken: 'page-access-token-abc123',
  refreshToken: '',
  expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
}

function makeContent(overrides: Partial<PlatformContent['content']> = {}, meta: Record<string, unknown> = {}): PlatformContent {
  return {
    itemId: 'item-fb-001',
    platform: 'facebook',
    content: {
      body: 'This is a test Facebook post with enough content.',
      hashtags: [],
      platformMeta: {pageId: '123456789', ...meta},
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

describe('FacebookAdapter', () => {
  let testDir: string
  let keychain: KeychainAdapter
  let credManager: CredentialManager
  let adapter: FacebookAdapter

  beforeEach(async () => {
    vi.restoreAllMocks()
    testDir = await createTestDir()
    keychain = createMockKeychain()
    credManager = new CredentialManager(keychain, testDir)

    await credManager.store('facebook', VALID_TOKENS, ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'])

    process.env['MAT_FACEBOOK_CLIENT_ID'] = 'test-fb-client-id'
    process.env['MAT_FACEBOOK_CLIENT_SECRET'] = 'test-fb-client-secret'
  })

  afterEach(async () => {
    await removeTestDir(testDir)
    delete process.env['MAT_FACEBOOK_CLIENT_ID']
    delete process.env['MAT_FACEBOOK_CLIENT_SECRET']
  })

  describe('publish', () => {
    it('publishes a text post successfully', async () => {
      const fixture = await loadFixture('facebook-feed-post-success.json')

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture),
          headers: new Headers(),
        }),
      })

      const content = makeContent()
      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(result.platform).toBe('facebook')
      expect(result.postId).toBe('123456789_987654321')
      expect(result.postUrl).toContain('facebook.com')
      expect(result.publishedAt).toBeTruthy()
    })

    it('publishes a link post successfully', async () => {
      const fixture = await loadFixture('facebook-feed-post-success.json')

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture),
          headers: new Headers(),
        }),
      })

      const content = makeContent({}, {link: 'https://example.com/article'})
      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(result.postId).toBe('123456789_987654321')
    })

    it('publishes a single photo post', async () => {
      const fixture = await loadFixture('facebook-photo-upload.json')

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture),
          headers: new Headers(),
        }),
      })

      const content = makeContent({
        media: [{type: 'image', url: 'https://example.com/photo.jpg'}],
      })
      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(result.postId).toBe('123456789_photo_111222333')
    })

    it('publishes a multi-photo post', async () => {
      const photoFixture = {id: 'unpub_photo_1'}
      const feedFixture = await loadFixture('facebook-feed-post-success.json')
      let callCount = 0

      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++
        // First 2 calls are photo uploads, third is feed post
        if (callCount <= 2) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: vi.fn().mockResolvedValue({...photoFixture, id: `unpub_photo_${callCount}`}),
            text: vi.fn().mockResolvedValue(''),
          }
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue(feedFixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn,
      })

      const content = makeContent({
        media: [
          {type: 'image', url: 'https://example.com/photo1.jpg'},
          {type: 'image', url: 'https://example.com/photo2.jpg'},
        ],
      })
      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(callCount).toBe(3) // 2 photo uploads + 1 feed post
    })

    it('returns failure when page ID is missing', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({}),
      })

      const content: PlatformContent = {
        itemId: 'item-fb-001',
        platform: 'facebook',
        content: {
          body: 'Test',
          platformMeta: {},
        },
      }
      const result = await adapter.publish(content)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FACEBOOK_MISSING_PAGE_ID')
      expect(result.error?.classification).toBe('permanent')
    })

    it('handles Graph API error code 190 (token expired) as permanent', async () => {
      const fixture = await loadFixture('facebook-error-190.json')

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue(JSON.stringify(fixture)),
          headers: new Headers(),
        }),
        sleepFn: vi.fn().mockResolvedValue(undefined),
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FACEBOOK_GRAPH_190')
      expect(result.error?.classification).toBe('permanent')
      expect(result.error?.retryable).toBe(false)
    })

    it('handles Graph API error code 4 (rate limit) as transient', async () => {
      const errorFixture = await loadFixture('facebook-error-4.json')
      const successFixture = await loadFixture('facebook-feed-post-success.json')
      let attempt = 0

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 400,
            headers: new Headers(),
            json: vi.fn().mockResolvedValue(errorFixture),
            text: vi.fn().mockResolvedValue(JSON.stringify(errorFixture)),
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

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('handles HTTP 500 as transient and retries', async () => {
      const successFixture = await loadFixture('facebook-feed-post-success.json')
      let attempt = 0

      const fetchFn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            json: vi.fn().mockResolvedValue({}),
            text: vi.fn().mockResolvedValue('Internal Server Error'),
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

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(true)
      expect(attempt).toBe(2)
    })

    it('fails after max retry attempts', async () => {
      // Use a throw-based failure so the outer catch triggers MAX_RETRIES
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network failure')) as typeof globalThis.fetch

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FACEBOOK_MAX_RETRIES')
      expect(result.error?.message).toContain('Network failure')
    })

    it('handles multi-photo partial upload failure', async () => {
      let callCount = 0

      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: vi.fn().mockResolvedValue({id: 'unpub_photo_1'}),
            text: vi.fn().mockResolvedValue(''),
          }
        }
        // Second photo upload fails
        return {
          ok: false,
          status: 500,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue({}),
          text: vi.fn().mockResolvedValue('Server Error'),
        }
      }) as typeof globalThis.fetch

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
      })

      const content = makeContent({
        media: [
          {type: 'image', url: 'https://example.com/photo1.jpg'},
          {type: 'image', url: 'https://example.com/photo2.jpg'},
        ],
      })
      const result = await adapter.publish(content)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FACEBOOK_MULTI_PHOTO_UPLOAD_FAILED')
    })
  })

  describe('validateContent', () => {
    it('validates a valid post', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({}),
      })

      const content = makeContent()
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects post exceeding 63,206 characters', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({}),
      })

      const content = makeContent({body: 'x'.repeat(63_207)})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.constraint === 'maxLength')).toBe(true)
    })

    it('detects duplicate consecutive posts', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({}),
        lastPublishedBody: 'Duplicate post content',
      })

      const content = makeContent({body: 'Duplicate post content'})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.constraint === 'duplicate')).toBe(true)
    })

    it('validates media URLs are HTTPS', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({}),
      })

      const content = makeContent({
        media: [{type: 'image', url: 'http://example.com/photo.jpg'}],
      })
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.constraint === 'https')).toBe(true)
    })
  })

  describe('getMetrics', () => {
    it('returns engagement metrics for a post', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue({
            id: '123456789_987654321',
            likes: {summary: {total_count: 42}},
            comments: {summary: {total_count: 7}},
            shares: {count: 3},
          }),
        }),
      })

      const metrics = await adapter.getMetrics('123456789_987654321')

      expect(metrics.platform).toBe('facebook')
      expect(metrics.likes).toBe(42)
      expect(metrics.comments).toBe(7)
      expect(metrics.shares).toBe(3)
    })

    it('returns empty metrics on invalid response', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue({invalid: true}),
        }),
      })

      const metrics = await adapter.getMetrics('123456789_987654321')
      expect(metrics.platform).toBe('facebook')
      expect(metrics.likes).toBeUndefined()
    })
  })

  describe('getRateLimits', () => {
    it('returns rate limit status', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({}),
      })

      const limits = await adapter.getRateLimits()

      expect(limits.platform).toBe('facebook')
      expect(limits.limit).toBe(4800)
      expect(limits.windowType).toBe('day')
    })
  })

  describe('disconnect', () => {
    it('removes credentials from keychain', async () => {
      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({}),
      })

      await adapter.disconnect()

      // Retrieving should throw after disconnect
      await expect(credManager.retrieve('facebook')).rejects.toThrow()
    })
  })

  describe('X-App-Usage header parsing', () => {
    it('parses X-App-Usage header and updates rate limits', async () => {
      const fixture = await loadFixture('facebook-feed-post-success.json')

      const appUsage = JSON.stringify({call_count: 28, total_cputime: 15, total_time: 22})

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(fixture),
          headers: new Headers({'x-app-usage': appUsage}),
        }),
      })

      await adapter.publish(makeContent())

      const limits = await adapter.getRateLimits()
      // 28% usage → 72% remaining → ~3456 calls
      expect(limits.remaining).toBeLessThan(4800)
      expect(limits.remaining).toBeGreaterThan(0)
    })

    it('throttles at 80% utilization', async () => {
      const fixture = await loadFixture('facebook-feed-post-success.json')
      const sleepFn = vi.fn().mockResolvedValue(undefined)

      const highUsage = JSON.stringify({call_count: 85, total_cputime: 50, total_time: 60})

      // First call returns high usage, subsequent calls return success
      let callCount = 0
      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++
        return {
          ok: true,
          status: 200,
          headers: new Headers({'x-app-usage': callCount === 1 ? highUsage : JSON.stringify({call_count: 10, total_cputime: 5, total_time: 8})}),
          json: vi.fn().mockResolvedValue(fixture),
          text: vi.fn().mockResolvedValue(''),
        }
      }) as typeof globalThis.fetch

      adapter = new FacebookAdapter({
        credentialManager: credManager,
        pageId: '123456789',
        fetchFn,
        sleepFn,
      })

      // First publish — sets high usage state
      await adapter.publish(makeContent({body: 'First post'}))

      // Second publish — should throttle because usage > 80%
      await adapter.publish(makeContent({body: 'Second post'}))

      // sleepFn should have been called for throttling
      expect(sleepFn).toHaveBeenCalled()
    })
  })

  describe('error classification', () => {
    it('classifies code 2 as transient', () => {
      expect(classifyFacebookErrorCode(2)).toBe('transient')
    })

    it('classifies code 4 as transient', () => {
      expect(classifyFacebookErrorCode(4)).toBe('transient')
    })

    it('classifies code 32 as transient', () => {
      expect(classifyFacebookErrorCode(32)).toBe('transient')
    })

    it('classifies code 190 as permanent', () => {
      expect(classifyFacebookErrorCode(190)).toBe('permanent')
    })

    it('classifies code 200 as permanent', () => {
      expect(classifyFacebookErrorCode(200)).toBe('permanent')
    })

    it('classifies code 368 as permanent', () => {
      expect(classifyFacebookErrorCode(368)).toBe('permanent')
    })

    it('classifies code 506 as permanent', () => {
      expect(classifyFacebookErrorCode(506)).toBe('permanent')
    })

    it('classifies code 100 as permanent', () => {
      expect(classifyFacebookErrorCode(100)).toBe('permanent')
    })

    it('classifies unknown codes as permanent', () => {
      expect(classifyFacebookErrorCode(999)).toBe('permanent')
    })

    it('classifies HTTP 429 as transient', () => {
      expect(classifyHttpStatus(429)).toBe('transient')
    })

    it('classifies HTTP 500 as transient', () => {
      expect(classifyHttpStatus(500)).toBe('transient')
    })

    it('classifies HTTP 503 as transient', () => {
      expect(classifyHttpStatus(503)).toBe('transient')
    })

    it('classifies HTTP 400 as permanent', () => {
      expect(classifyHttpStatus(400)).toBe('permanent')
    })

    it('classifies HTTP 401 as permanent', () => {
      expect(classifyHttpStatus(401)).toBe('permanent')
    })
  })
})
