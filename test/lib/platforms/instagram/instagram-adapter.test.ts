import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {InstagramAdapter} from '../../../../src/lib/platforms/instagram/instagram-adapter.js'
import {classifyInstagramErrorCode, classifyHttpStatus} from '../../../../src/lib/platforms/instagram/errors.js'
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
  accessToken: 'page-access-token-ig-abc123',
  refreshToken: '',
  expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
}

function makeContent(
  overrides: Partial<PlatformContent['content']> = {},
  meta: Record<string, unknown> = {},
): PlatformContent {
  return {
    itemId: 'item-ig-001',
    platform: 'instagram',
    content: {
      body: 'Check out this amazing post! 📸',
      hashtags: ['#marketing', '#content'],
      media: [{type: 'image', url: 'https://cdn.example.com/photo.jpg'}],
      platformMeta: {igUserId: '17841401234567890', ...meta},
      ...overrides,
    },
  }
}

function mockFetch(
  response: Partial<Response> & {json?: () => Promise<unknown>; text?: () => Promise<string>; headers?: Headers},
): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    ...response,
  })
}

function mockSequentialFetch(
  ...responses: Array<{ok?: boolean; status?: number; data: unknown}>
): typeof globalThis.fetch {
  const fn = vi.fn()
  for (const [i, resp] of responses.entries()) {
    fn.mockResolvedValueOnce({
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(resp.data),
      text: vi.fn().mockResolvedValue(JSON.stringify(resp.data)),
    })
  }
  return fn
}

const FIXTURE_DIR = join(import.meta.dirname, '../../../fixtures/responses')

async function loadFixture(name: string): Promise<unknown> {
  const content = await readFile(join(FIXTURE_DIR, name), 'utf-8')
  return JSON.parse(content)
}

// --- Tests ---

describe('InstagramAdapter', () => {
  let testDir: string
  let keychain: KeychainAdapter
  let credManager: CredentialManager
  let adapter: InstagramAdapter

  beforeEach(async () => {
    vi.restoreAllMocks()
    testDir = await createTestDir()
    keychain = createMockKeychain()
    credManager = new CredentialManager(keychain, testDir)

    await credManager.store('instagram', VALID_TOKENS, [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ])

    process.env['MAT_INSTAGRAM_CLIENT_ID'] = 'test-ig-client-id'
    process.env['MAT_INSTAGRAM_CLIENT_SECRET'] = 'test-ig-client-secret'
  })

  afterEach(async () => {
    await removeTestDir(testDir)
    delete process.env['MAT_INSTAGRAM_CLIENT_ID']
    delete process.env['MAT_INSTAGRAM_CLIENT_SECRET']
  })

  describe('platform identifier', () => {
    it('returns "instagram" as its platform', () => {
      adapter = new InstagramAdapter({credentialManager: credManager})
      expect(adapter.platform).toBe('instagram')
    })
  })

  describe('publish — single image', () => {
    it('publishes a single image via two-step container process', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},  // Create container
        {data: statusFixture},     // Poll status → FINISHED
        {data: publishFixture},    // Publish
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(true)
      expect(result.platform).toBe('instagram')
      expect(result.postId).toBe('17891234567890123')
      expect(result.publishedAt).toBeDefined()

      // Verify create container call
      expect(fetchFn).toHaveBeenCalledTimes(3)
      const createCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(createCall[0]).toContain('/17841401234567890/media')
      expect(createCall[1]!.method).toBe('POST')
    })

    it('fails when no media is provided', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn: vi.fn(),
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const content = makeContent({media: []})
      const result = await adapter.publish(content)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSTAGRAM_MISSING_MEDIA')
    })

    it('fails when igUserId is missing', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content: PlatformContent = {
        itemId: 'item-001',
        platform: 'instagram',
        content: {
          body: 'Test',
          media: [{type: 'image', url: 'https://cdn.example.com/photo.jpg'}],
          platformMeta: {},
        },
      }

      const result = await adapter.publish(content)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSTAGRAM_MISSING_USER_ID')
    })
  })

  describe('publish — Reels', () => {
    it('publishes a Reel with media_type=REELS', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},  // Create REELS container
        {data: statusFixture},     // Poll status → FINISHED
        {data: publishFixture},    // Publish
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const content = makeContent({
        media: [{type: 'video', url: 'https://cdn.example.com/video.mp4'}],
      })

      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(result.postId).toBe('17891234567890123')

      // Verify REELS media_type was set
      const createCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      const body = createCall[1]!.body as URLSearchParams
      expect(body.get('media_type')).toBe('REELS')
      expect(body.get('video_url')).toBe('https://cdn.example.com/video.mp4')
      expect(body.get('share_to_feed')).toBe('true')
    })
  })

  describe('publish — carousel', () => {
    it('publishes a carousel with child containers', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      // child 1, child 2, parent carousel, poll status, publish
      const fetchFn = mockSequentialFetch(
        {data: {id: 'child-1'}},     // Child container 1
        {data: {id: 'child-2'}},     // Child container 2
        {data: containerFixture},     // Parent carousel container
        {data: statusFixture},        // Poll status → FINISHED
        {data: publishFixture},       // Publish
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const content = makeContent({
        media: [
          {type: 'image', url: 'https://cdn.example.com/photo1.jpg'},
          {type: 'image', url: 'https://cdn.example.com/photo2.jpg'},
        ],
      })

      const result = await adapter.publish(content)

      expect(result.success).toBe(true)
      expect(result.postId).toBe('17891234567890123')

      // Verify child containers have is_carousel_item=true
      const child1Call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      const child1Body = child1Call[1]!.body as URLSearchParams
      expect(child1Body.get('is_carousel_item')).toBe('true')

      // Verify parent carousel has CAROUSEL media_type and children
      const carouselCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[2]!
      const carouselBody = carouselCall[1]!.body as URLSearchParams
      expect(carouselBody.get('media_type')).toBe('CAROUSEL')
      expect(carouselBody.get('children')).toBe('child-1,child-2')
    })

    it('handles carousel with video items', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      const fetchFn = mockSequentialFetch(
        {data: {id: 'child-img'}},
        {data: {id: 'child-vid'}},
        {data: containerFixture},
        {data: statusFixture},
        {data: publishFixture},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const content = makeContent({
        media: [
          {type: 'image', url: 'https://cdn.example.com/photo.jpg'},
          {type: 'video', url: 'https://cdn.example.com/video.mp4'},
        ],
      })

      const result = await adapter.publish(content)

      expect(result.success).toBe(true)

      // Video child should have media_type=VIDEO
      const vidCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1]!
      const vidBody = vidCall[1]!.body as URLSearchParams
      expect(vidBody.get('media_type')).toBe('VIDEO')
      expect(vidBody.get('video_url')).toBe('https://cdn.example.com/video.mp4')
    })
  })

  describe('container status polling', () => {
    it('handles EXPIRED container status', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},
        {data: {id: '123', status_code: 'EXPIRED'}},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
        pollIntervalMs: 1,
        pollTimeoutMs: 100,
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSTAGRAM_CONTAINER_EXPIRED')
      expect(result.error?.classification).toBe('permanent')
      expect(result.error?.retryable).toBe(false)
    })

    it('handles ERROR container status', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},
        {data: {id: '123', status_code: 'ERROR'}},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
        pollIntervalMs: 1,
        pollTimeoutMs: 100,
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSTAGRAM_CONTAINER_ERROR')
    })

    it('polls IN_PROGRESS until FINISHED', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const publishFixture = await loadFixture('instagram-published.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},
        {data: {id: '123', status_code: 'IN_PROGRESS'}},
        {data: {id: '123', status_code: 'IN_PROGRESS'}},
        {data: {id: '123', status_code: 'FINISHED'}},
        {data: publishFixture},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
        pollIntervalMs: 1,
        pollTimeoutMs: 10_000,
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(true)
      // 1 create + 3 polls + 1 publish = 5 calls
      expect(fetchFn).toHaveBeenCalledTimes(5)
    })

    it('times out when container stays IN_PROGRESS', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')

      // Always return IN_PROGRESS
      const fetchFn = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/media') && !url.includes('status_code')) {
          return {
            ok: true, status: 200, headers: new Headers(),
            json: vi.fn().mockResolvedValue(containerFixture),
            text: vi.fn().mockResolvedValue(''),
          }
        }
        return {
          ok: true, status: 200, headers: new Headers(),
          json: vi.fn().mockResolvedValue({id: '123', status_code: 'IN_PROGRESS'}),
          text: vi.fn().mockResolvedValue(''),
        }
      })

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
        pollIntervalMs: 1,
        pollTimeoutMs: 10, // Very short timeout
      })

      const result = await adapter.publish(makeContent())

      // Should eventually time out and retry, then fail after max retries
      expect(result.success).toBe(false)
      expect(result.error?.code).toMatch(/INSTAGRAM_CONTAINER_TIMEOUT|INSTAGRAM_MAX_RETRIES/)
    })
  })

  describe('content validation', () => {
    it('validates caption max 2200 chars', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content = makeContent({body: 'x'.repeat(2201)})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'body' && e.constraint === 'maxLength')).toBe(true)
    })

    it('validates max 30 hashtags', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const hashtags = Array.from({length: 31}, (_, i) => `#tag${i}`)
      const content = makeContent({hashtags})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'hashtags' && e.constraint === 'maxCount')).toBe(true)
    })

    it('validates media URLs must be HTTPS', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content = makeContent({
        media: [{type: 'image', url: 'http://insecure.example.com/photo.jpg'}],
      })
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.url' && e.constraint === 'https')).toBe(true)
    })

    it('validates aspect ratio range', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      // Too wide (> 1.91:1)
      const content = makeContent({}, {aspectRatio: 2.5})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.aspectRatio' && e.constraint === 'range')).toBe(true)
    })

    it('validates aspect ratio too narrow', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      // Too narrow (< 4:5 = 0.8)
      const content = makeContent({}, {aspectRatio: 0.5})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.aspectRatio')).toBe(true)
    })

    it('validates video format (MP4/MOV only)', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content = makeContent(
        {media: [{type: 'video', url: 'https://cdn.example.com/video.avi'}]},
        {videoFormat: 'avi'},
      )
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.videoFormat' && e.constraint === 'format')).toBe(true)
    })

    it('validates video duration range', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content = makeContent(
        {media: [{type: 'video', url: 'https://cdn.example.com/video.mp4'}]},
        {videoDuration: 1000},
      )
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.videoDuration')).toBe(true)
    })

    it('validates video too short', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content = makeContent(
        {media: [{type: 'video', url: 'https://cdn.example.com/video.mp4'}]},
        {videoDuration: 1},
      )
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.videoDuration')).toBe(true)
    })

    it('validates carousel max 10 items', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const media = Array.from({length: 11}, (_, i) => ({
        type: 'image' as const,
        url: `https://cdn.example.com/photo${i}.jpg`,
      }))
      const content = makeContent({media})
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media' && e.constraint === 'carouselMaxItems')).toBe(true)
    })

    it('passes validation for valid content', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn: vi.fn(),
        log: vi.fn(),
      })

      const content = makeContent()
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('checks publishing quota and warns when approaching limit', async () => {
      const quotaFetch = mockFetch({
        json: vi.fn().mockResolvedValue({
          config: {quota_total: 50},
          quota_usage: 46,
        }),
      })

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn: quotaFetch,
        log: vi.fn(),
      })

      const content = makeContent()
      const result = await adapter.validateContent(content)

      expect(result.valid).toBe(true)
      expect(result.warnings.some((w) => w.field === 'publishingLimit')).toBe(true)
    })
  })

  describe('error classification', () => {
    it('classifies code 4 as transient', () => {
      expect(classifyInstagramErrorCode(4)).toBe('transient')
    })

    it('classifies code 9 as transient', () => {
      expect(classifyInstagramErrorCode(9)).toBe('transient')
    })

    it('classifies code 32 as transient', () => {
      expect(classifyInstagramErrorCode(32)).toBe('transient')
    })

    it('classifies code 190 as permanent', () => {
      expect(classifyInstagramErrorCode(190)).toBe('permanent')
    })

    it('classifies code 200 as permanent', () => {
      expect(classifyInstagramErrorCode(200)).toBe('permanent')
    })

    it('classifies code 10 as permanent', () => {
      expect(classifyInstagramErrorCode(10)).toBe('permanent')
    })

    it('classifies code 36003 as permanent', () => {
      expect(classifyInstagramErrorCode(36003)).toBe('permanent')
    })

    it('classifies unknown code as permanent', () => {
      expect(classifyInstagramErrorCode(99999)).toBe('permanent')
    })

    it('classifies HTTP 429 as transient', () => {
      expect(classifyHttpStatus(429)).toBe('transient')
    })

    it('classifies HTTP 500-599 as transient', () => {
      expect(classifyHttpStatus(500)).toBe('transient')
      expect(classifyHttpStatus(502)).toBe('transient')
      expect(classifyHttpStatus(503)).toBe('transient')
    })

    it('classifies HTTP 400 as permanent', () => {
      expect(classifyHttpStatus(400)).toBe('permanent')
    })
  })

  describe('publish — error handling', () => {
    it('handles Graph API error (code 190 — token expired)', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const errorFixture = await loadFixture('instagram-error-190.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},
        {data: await loadFixture('instagram-container-finished.json')},
        {ok: false, status: 400, data: errorFixture},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSTAGRAM_GRAPH_190')
      expect(result.error?.classification).toBe('permanent')
      expect(result.error?.retryable).toBe(false)
    })

    it('retries transient errors and eventually succeeds', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      // First attempt: transient API error on container create
      // Second attempt: success
      const fetchFn = mockSequentialFetch(
        {ok: false, status: 500, data: 'Internal Server Error'},
        {data: containerFixture},
        {data: statusFixture},
        {data: publishFixture},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(true)
    })
  })

  describe('getMetrics', () => {
    it('retrieves engagement metrics for a published post', async () => {
      const fetchFn = mockFetch({
        json: vi.fn().mockResolvedValue({
          id: '17891234567890123',
          like_count: 150,
          comments_count: 23,
          impressions: 5000,
          reach: 3500,
          saved: 42,
          shares: 15,
        }),
      })

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn,
        log: vi.fn(),
      })

      const metrics = await adapter.getMetrics('17891234567890123')

      expect(metrics.platform).toBe('instagram')
      expect(metrics.postId).toBe('17891234567890123')
      expect(metrics.likes).toBe(150)
      expect(metrics.comments).toBe(23)
      expect(metrics.views).toBe(5000)
      expect(metrics.shares).toBe(15)
      expect(metrics.retrievedAt).toBeDefined()
    })

    it('returns partial metrics when some fields are missing', async () => {
      const fetchFn = mockFetch({
        json: vi.fn().mockResolvedValue({
          id: '17891234567890123',
          like_count: 100,
        }),
      })

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        fetchFn,
        log: vi.fn(),
      })

      const metrics = await adapter.getMetrics('17891234567890123')

      expect(metrics.likes).toBe(100)
      expect(metrics.comments).toBeUndefined()
      expect(metrics.views).toBeUndefined()
    })
  })

  describe('getRateLimits', () => {
    it('returns current rate limit status', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        log: vi.fn(),
      })

      const limits = await adapter.getRateLimits()

      expect(limits.platform).toBe('instagram')
      expect(limits.limit).toBe(200)
      expect(limits.windowType).toBe('hour')
    })
  })

  describe('disconnect', () => {
    it('removes Instagram credentials from keychain', async () => {
      adapter = new InstagramAdapter({
        credentialManager: credManager,
        log: vi.fn(),
      })

      await adapter.disconnect()

      // Verify credentials are removed
      await expect(credManager.retrieve('instagram')).rejects.toThrow()
    })
  })

  describe('caption building with hashtags', () => {
    it('appends hashtags to caption', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},
        {data: statusFixture},
        {data: publishFixture},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const content = makeContent({
        body: 'Great post',
        hashtags: ['marketing', '#growth'],
      })

      await adapter.publish(content)

      // Verify caption includes hashtags
      const createCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      const body = createCall[1]!.body as URLSearchParams
      const caption = body.get('caption')!
      expect(caption).toContain('Great post')
      expect(caption).toContain('#marketing')
      expect(caption).toContain('#growth')
    })

    it('adds # prefix to hashtags without it', async () => {
      const containerFixture = await loadFixture('instagram-container-created.json')
      const statusFixture = await loadFixture('instagram-container-finished.json')
      const publishFixture = await loadFixture('instagram-published.json')

      const fetchFn = mockSequentialFetch(
        {data: containerFixture},
        {data: statusFixture},
        {data: publishFixture},
      )

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        igUserId: '17841401234567890',
        fetchFn,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
      })

      const content = makeContent({
        body: 'Post',
        hashtags: ['notag'],
      })

      await adapter.publish(content)

      const createCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!
      const body = createCall[1]!.body as URLSearchParams
      expect(body.get('caption')).toContain('#notag')
    })
  })

  describe('authenticate', () => {
    it('returns error when OAuth credentials are not configured', async () => {
      delete process.env['MAT_INSTAGRAM_CLIENT_ID']
      delete process.env['MAT_INSTAGRAM_CLIENT_SECRET']

      adapter = new InstagramAdapter({
        credentialManager: credManager,
        log: vi.fn(),
      })

      const result = await adapter.authenticate()

      expect(result.success).toBe(false)
      expect(result.error).toContain('MAT_INSTAGRAM_CLIENT_ID')
    })
  })
})
