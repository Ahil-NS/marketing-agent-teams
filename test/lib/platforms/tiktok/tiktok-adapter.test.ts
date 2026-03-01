import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {TikTokAdapter} from '../../../../src/lib/platforms/tiktok/tiktok-adapter.js'
import {classifyTikTokErrorCode, classifyHttpStatus} from '../../../../src/lib/platforms/tiktok/errors.js'
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
  accessToken: 'act.test-access-token',
  refreshToken: 'rft.test-refresh-token',
  expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
}

function makeContent(
  overrides: Partial<PlatformContent['content']> = {},
  meta: Record<string, unknown> = {},
): PlatformContent {
  return {
    itemId: 'item-tiktok-001',
    platform: 'tiktok',
    content: {
      body: 'Check out this amazing marketing tip! #marketing #growth',
      hashtags: ['marketing', 'growth'],
      media: [{type: 'video', url: 'https://cdn.example.com/video.mp4'}],
      platformMeta: {
        privacy_level: 'PUBLIC_TO_EVERYONE',
        ...meta,
      },
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
  ...responses: Array<Partial<Response> & {json?: () => Promise<unknown>; text?: () => Promise<string>}>
): typeof globalThis.fetch {
  const fn = vi.fn()
  for (const response of responses) {
    fn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
      ...response,
    })
  }
  return fn
}

const FIXTURE_DIR = join(import.meta.dirname, '../../../fixtures/responses')

async function loadFixture(name: string): Promise<unknown> {
  const content = await readFile(join(FIXTURE_DIR, name), 'utf-8')
  return JSON.parse(content)
}

const noopSleep = vi.fn().mockResolvedValue(undefined)

// --- Tests ---

describe('TikTokAdapter', () => {
  let testDir: string
  let keychain: KeychainAdapter
  let credManager: CredentialManager
  let adapter: TikTokAdapter

  beforeEach(async () => {
    vi.restoreAllMocks()
    testDir = await createTestDir()
    keychain = createMockKeychain()
    credManager = new CredentialManager(keychain, testDir)

    await credManager.store('tiktok', VALID_TOKENS, ['video.publish', 'user.info.basic'])

    process.env['MAT_TIKTOK_CLIENT_ID'] = 'test-client-key'
    process.env['MAT_TIKTOK_CLIENT_SECRET'] = 'test-client-secret'
  })

  afterEach(async () => {
    await removeTestDir(testDir)
    delete process.env['MAT_TIKTOK_CLIENT_ID']
    delete process.env['MAT_TIKTOK_CLIENT_SECRET']
  })

  describe('platform', () => {
    it('returns tiktok', () => {
      adapter = new TikTokAdapter({credentialManager: credManager, sleepFn: noopSleep})
      expect(adapter.platform).toBe('tiktok')
    })
  })

  describe('validateContent', () => {
    it('validates valid content successfully', async () => {
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(creatorInfoFixture),
        }),
        sleepFn: noopSleep,
      })

      const result = await adapter.validateContent(makeContent())
      expect(result.valid).toBe(true)
      expect(result.platform).toBe('tiktok')
      expect(result.errors).toHaveLength(0)
    })

    it('rejects caption exceeding 2,200 UTF-16 characters', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({json: vi.fn().mockResolvedValue(await loadFixture('tiktok-creator-info.json'))}),
        sleepFn: noopSleep,
      })

      const longCaption = 'A'.repeat(2201)
      const result = await adapter.validateContent(
        makeContent({body: longCaption}),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'body' && e.constraint === 'maxLength')).toBe(true)
    })

    it('rejects photo title exceeding 150 UTF-16 characters', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({json: vi.fn().mockResolvedValue(await loadFixture('tiktok-creator-info.json'))}),
        sleepFn: noopSleep,
      })

      const longTitle = 'T'.repeat(151)
      const result = await adapter.validateContent(
        makeContent({title: longTitle}),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'title' && e.constraint === 'maxLength')).toBe(true)
    })

    it('rejects non-HTTPS video URL', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({json: vi.fn().mockResolvedValue(await loadFixture('tiktok-creator-info.json'))}),
        sleepFn: noopSleep,
      })

      const result = await adapter.validateContent(
        makeContent({media: [{type: 'video', url: 'http://insecure.com/video.mp4'}]}),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media.url' && e.constraint === 'protocol')).toBe(true)
    })

    it('rejects invalid privacy level', async () => {
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(creatorInfoFixture),
        }),
        sleepFn: noopSleep,
      })

      const result = await adapter.validateContent(
        makeContent({}, {privacy_level: 'INVALID_LEVEL'}),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'platformMeta.privacy_level')).toBe(true)
    })

    it('accepts valid privacy level from creator info', async () => {
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue(creatorInfoFixture),
        }),
        sleepFn: noopSleep,
      })

      const result = await adapter.validateContent(
        makeContent({}, {privacy_level: 'SELF_ONLY'}),
      )
      expect(result.valid).toBe(true)
    })

    it('warns when creator info cannot be fetched', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({ok: false, status: 500, text: vi.fn().mockResolvedValue('Internal error')}),
        sleepFn: noopSleep,
      })

      const result = await adapter.validateContent(makeContent())

      // Should still be valid (unable to verify privacy but no hard error)
      // Warning should be present about privacy level verification
      expect(result.warnings.some((w) => w.field === 'platformMeta.privacy_level')).toBe(true)
    })

    it('requires media attachment', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({json: vi.fn().mockResolvedValue(await loadFixture('tiktok-creator-info.json'))}),
        sleepFn: noopSleep,
      })

      const result = await adapter.validateContent(
        makeContent({media: []}),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media')).toBe(true)
    })
  })

  describe('publish', () => {
    it('publishes video via PULL_FROM_URL and polls status to completion', async () => {
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusCompleteFixture = await loadFixture('tiktok-status-complete.json')
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockSequentialFetch(
        // 1. Creator info query
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        // 2. Publish init
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        // 3. Status poll → complete
        {json: vi.fn().mockResolvedValue(statusCompleteFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(true)
      expect(result.platform).toBe('tiktok')
      expect(result.postId).toBe('pub_v2_1234567890')
      expect(result.publishedAt).toBeDefined()
    })

    it('returns error when publish status is FAILED', async () => {
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusFailedFixture = await loadFixture('tiktok-status-failed.json')
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockSequentialFetch(
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        {json: vi.fn().mockResolvedValue(statusFailedFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const result = await adapter.publish(makeContent())

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('url_ownership_unverified')
      expect(result.error?.classification).toBe('permanent')
    })

    it('returns error when video URL is missing', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({}),
        sleepFn: noopSleep,
      })

      const result = await adapter.publish(
        makeContent({media: []}),
      )

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TIKTOK_MISSING_VIDEO_URL')
      expect(result.error?.classification).toBe('permanent')
    })

    it('sets is_aigc to true for AI-generated content', async () => {
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusCompleteFixture = await loadFixture('tiktok-status-complete.json')
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockSequentialFetch(
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        {json: vi.fn().mockResolvedValue(statusCompleteFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      await adapter.publish(makeContent())

      // Second call is the publish init
      const publishCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1]!
      const body = JSON.parse(publishCall[1].body as string)
      expect(body.post_info.is_aigc).toBe(true)
    })

    it('uses JSON content-type for publish init', async () => {
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusCompleteFixture = await loadFixture('tiktok-status-complete.json')
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockSequentialFetch(
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        {json: vi.fn().mockResolvedValue(statusCompleteFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      await adapter.publish(makeContent())

      // Second call is publish init
      const publishCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1]!
      expect(publishCall[1].headers['Content-Type']).toBe('application/json; charset=UTF-8')
    })

    it('handles transient HTTP error with retry', async () => {
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusCompleteFixture = await loadFixture('tiktok-status-complete.json')

      const fetchFn = mockSequentialFetch(
        // Creator info
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        // First publish attempt → 500
        {ok: false, status: 500, text: vi.fn().mockResolvedValue('Server Error')},
        // Retry: creator info cached, publish init succeeds
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        // Status poll
        {json: vi.fn().mockResolvedValue(statusCompleteFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(true)
    })

    it('returns permanent error for TikTok API error code', async () => {
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockSequentialFetch(
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        {
          json: vi.fn().mockResolvedValue({
            data: null,
            error: {code: 'url_ownership_unverified', message: 'Domain not verified'},
          }),
        },
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('url_ownership_unverified')
      expect(result.error?.classification).toBe('permanent')
    })

    it('defaults to SELF_ONLY privacy when creator info unavailable and no privacy specified', async () => {
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusCompleteFixture = await loadFixture('tiktok-status-complete.json')

      const fetchFn = mockSequentialFetch(
        // Creator info fails
        {ok: false, status: 500, text: vi.fn().mockResolvedValue('Error')},
        // Publish init succeeds
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        // Status complete
        {json: vi.fn().mockResolvedValue(statusCompleteFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const content = makeContent({}, {})
      // Remove privacy_level
      delete content.content.platformMeta['privacy_level']

      const result = await adapter.publish(content)
      expect(result.success).toBe(true)

      // Verify SELF_ONLY was used
      const publishCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1]!
      const body = JSON.parse(publishCall[1].body as string)
      expect(body.post_info.privacy_level).toBe('SELF_ONLY')
    })

    it('enforces pending upload limit', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({}),
        sleepFn: noopSleep,
      })

      // Simulate 5 pending uploads
      // @ts-expect-error -- accessing private for test
      adapter.rateLimitState.pendingUploads = 5
      // @ts-expect-error -- accessing private for test
      adapter.rateLimitState.pendingUploadsResetAt = Date.now() + 24 * 3600 * 1000

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('spam_risk_too_many_pending_share')
      expect(result.error?.classification).toBe('transient')
    })

    it('reads video_url from platformMeta when no media attachment', async () => {
      const publishInitFixture = await loadFixture('tiktok-publish-init.json')
      const statusCompleteFixture = await loadFixture('tiktok-status-complete.json')
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockSequentialFetch(
        {json: vi.fn().mockResolvedValue(creatorInfoFixture)},
        {json: vi.fn().mockResolvedValue(publishInitFixture)},
        {json: vi.fn().mockResolvedValue(statusCompleteFixture)},
      )

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const content = makeContent(
        {media: []},
        {video_url: 'https://cdn.example.com/alt-video.mp4'},
      )

      const result = await adapter.publish(content)
      expect(result.success).toBe(true)
    })
  })

  describe('queryCreatorInfo', () => {
    it('retrieves and caches creator info', async () => {
      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const fetchFn = mockFetch({
        json: vi.fn().mockResolvedValue(creatorInfoFixture),
      })

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      const info = await adapter.queryCreatorInfo()
      expect(info.privacyLevelOptions).toEqual(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'])
      expect(info.maxVideoPostDurationSec).toBe(600)

      // Second call should use cache (no additional fetch)
      const info2 = await adapter.queryCreatorInfo()
      expect(info2).toEqual(info)
      expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    })

    it('throws on API error', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({ok: false, status: 500, text: vi.fn().mockResolvedValue('Error')}),
        sleepFn: noopSleep,
      })

      await expect(adapter.queryCreatorInfo()).rejects.toThrow()
    })
  })

  describe('getMetrics', () => {
    it('retrieves video metrics', async () => {
      const videoResponse = {
        data: {
          videos: [
            {
              id: 'video-123',
              title: 'Test Video',
              like_count: 1500,
              comment_count: 200,
              share_count: 50,
              view_count: 50000,
            },
          ],
        },
        error: {code: 'ok', message: ''},
      }

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({json: vi.fn().mockResolvedValue(videoResponse)}),
        sleepFn: noopSleep,
      })

      const metrics = await adapter.getMetrics('video-123')
      expect(metrics.platform).toBe('tiktok')
      expect(metrics.views).toBe(50000)
      expect(metrics.likes).toBe(1500)
      expect(metrics.comments).toBe(200)
      expect(metrics.shares).toBe(50)
    })

    it('returns empty metrics when video not found', async () => {
      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: mockFetch({
          json: vi.fn().mockResolvedValue({data: {videos: []}, error: {code: 'ok', message: ''}}),
        }),
        sleepFn: noopSleep,
      })

      const metrics = await adapter.getMetrics('nonexistent')
      expect(metrics.views).toBeUndefined()
      expect(metrics.likes).toBeUndefined()
    })
  })

  describe('getRateLimits', () => {
    it('returns current rate limit state', async () => {
      adapter = new TikTokAdapter({credentialManager: credManager, sleepFn: noopSleep})

      const limits = await adapter.getRateLimits()
      expect(limits.platform).toBe('tiktok')
      expect(limits.limit).toBe(6)
      expect(limits.windowType).toBe('minute')
    })
  })

  describe('disconnect', () => {
    it('revokes token and removes credentials', async () => {
      const fetchFn = mockFetch({ok: true, status: 200})

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      await adapter.disconnect()

      // Token should be revoked
      expect((fetchFn as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce()

      // Credentials should be removed
      await expect(credManager.retrieve('tiktok')).rejects.toThrow()
    })

    it('removes credentials even if revocation fails', async () => {
      const fetchFn = mockFetch({ok: false, status: 500, text: vi.fn().mockResolvedValue('Error')})

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn,
        sleepFn: noopSleep,
      })

      await adapter.disconnect()

      // Credentials should still be removed
      await expect(credManager.retrieve('tiktok')).rejects.toThrow()
    })
  })

  describe('token refresh', () => {
    it('refreshes token proactively when about to expire', async () => {
      // Store a token that's about to expire (3 min remaining)
      const expiringTokens: TokenData = {
        accessToken: 'act.expiring',
        refreshToken: 'rft.valid',
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      }
      await credManager.store('tiktok', expiringTokens, ['video.publish', 'user.info.basic'])

      const creatorInfoFixture = await loadFixture('tiktok-creator-info.json')

      const refreshResponse = {
        access_token: 'act.refreshed',
        expires_in: 86400,
        open_id: 'open_id_12345',
        refresh_expires_in: 31536000,
        refresh_token: 'rft.new-rotated',
        scope: 'video.publish,user.info.basic',
        token_type: 'Bearer',
      }

      // After refresh, the stored token will have a long expiry, so subsequent
      // ensureFreshToken calls will NOT trigger another refresh.
      const fetchFn = vi.fn()
        // queryCreatorInfo → ensureFreshToken → refresh (token expiring)
        .mockResolvedValueOnce({ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue(refreshResponse), text: vi.fn().mockResolvedValue('')})
        // queryCreatorInfo → creator info call
        .mockResolvedValueOnce({ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue(creatorInfoFixture), text: vi.fn().mockResolvedValue('')})
        // publish → ensureFreshToken → token is now fresh (no refresh call)
        // publish → publish init
        .mockResolvedValueOnce({ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue(await loadFixture('tiktok-publish-init.json')), text: vi.fn().mockResolvedValue('')})
        // status poll
        .mockResolvedValueOnce({ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue(await loadFixture('tiktok-status-complete.json')), text: vi.fn().mockResolvedValue('')})

      adapter = new TikTokAdapter({
        credentialManager: credManager,
        fetchFn: fetchFn as unknown as typeof globalThis.fetch,
        sleepFn: noopSleep,
      })

      const result = await adapter.publish(makeContent())
      expect(result.success).toBe(true)

      // Verify refresh was called (first fetch call should be to token endpoint)
      const firstCall = fetchFn.mock.calls[0]!
      expect(firstCall[0]).toContain('/v2/oauth/token/')
    })
  })

  describe('error classification', () => {
    it('classifies 429 as transient', () => {
      expect(classifyHttpStatus(429)).toBe('transient')
    })

    it('classifies 500 as transient', () => {
      expect(classifyHttpStatus(500)).toBe('transient')
    })

    it('classifies 503 as transient', () => {
      expect(classifyHttpStatus(503)).toBe('transient')
    })

    it('classifies 400 as permanent', () => {
      expect(classifyHttpStatus(400)).toBe('permanent')
    })

    it('classifies 401 as permanent', () => {
      expect(classifyHttpStatus(401)).toBe('permanent')
    })

    it('classifies rate_limit_exceeded as transient', () => {
      expect(classifyTikTokErrorCode('rate_limit_exceeded')).toBe('transient')
    })

    it('classifies spam_risk_too_many_pending_share as transient', () => {
      expect(classifyTikTokErrorCode('spam_risk_too_many_pending_share')).toBe('transient')
    })

    it('classifies token_expired as permanent', () => {
      expect(classifyTikTokErrorCode('token_expired')).toBe('permanent')
    })

    it('classifies privacy_level_option_mismatch as permanent', () => {
      expect(classifyTikTokErrorCode('privacy_level_option_mismatch')).toBe('permanent')
    })

    it('classifies url_ownership_unverified as permanent', () => {
      expect(classifyTikTokErrorCode('url_ownership_unverified')).toBe('permanent')
    })

    it('classifies unaudited_client as permanent', () => {
      expect(classifyTikTokErrorCode('unaudited_client_can_only_post_to_private_accounts')).toBe('permanent')
    })

    it('classifies unknown error as permanent', () => {
      expect(classifyTikTokErrorCode('some_unknown_error')).toBe('permanent')
    })
  })

  describe('authenticate', () => {
    it('returns error when OAuth credentials are not configured', async () => {
      delete process.env['MAT_TIKTOK_CLIENT_ID']
      delete process.env['MAT_TIKTOK_CLIENT_SECRET']

      adapter = new TikTokAdapter({credentialManager: credManager, sleepFn: noopSleep})
      const result = await adapter.authenticate()

      expect(result.success).toBe(false)
      expect(result.error).toContain('MAT_TIKTOK_CLIENT_ID')
    })
  })
})
