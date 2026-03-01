import {describe, it, expect} from 'vitest'

import {StubAdapter} from '../../../../src/lib/platforms/adapters/stub-adapter.js'
import type {PlatformContent} from '../../../../src/lib/platforms/types.js'

const validRedditContent: PlatformContent = {
  itemId: 'item-1',
  platform: 'reddit',
  content: {
    title: 'Test Post',
    body: 'This is a test post',
    platformMeta: {subreddit: 'r/test'},
  },
}

const validTiktokContent: PlatformContent = {
  itemId: 'item-2',
  platform: 'tiktok',
  content: {
    body: 'Short caption',
    media: [{type: 'video', url: 'https://example.com/video.mp4'}],
    platformMeta: {},
  },
}

describe('StubAdapter', () => {
  describe('authenticate', () => {
    it('returns successful auth by default', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      const result = await adapter.authenticate()
      expect(result.success).toBe(true)
      expect(result.platform).toBe('reddit')
      expect(result.scopes).toContain('read')
      expect(result.scopes).toContain('write')
      expect(result.expiresAt).toBeDefined()
    })

    it('returns failure auth when configured', async () => {
      const adapter = new StubAdapter({platform: 'tiktok', shouldFailAuth: true})
      const result = await adapter.authenticate()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('merges custom auth result fields', async () => {
      const adapter = new StubAdapter({
        platform: 'instagram',
        authResult: {scopes: ['photos', 'insights']},
      })
      const result = await adapter.authenticate()
      expect(result.success).toBe(true)
      expect(result.scopes).toEqual(['photos', 'insights'])
    })
  })

  describe('validateContent', () => {
    it('validates valid Reddit content', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      const result = await adapter.validateContent(validRedditContent)
      expect(result.valid).toBe(true)
      expect(result.platform).toBe('reddit')
    })

    it('returns errors for invalid content', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      const invalid: PlatformContent = {
        itemId: 'item-3',
        platform: 'reddit',
        content: {body: 'No title', platformMeta: {}},
      }
      const result = await adapter.validateContent(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('delegates to content validator for TikTok', async () => {
      const adapter = new StubAdapter({platform: 'tiktok'})
      const result = await adapter.validateContent(validTiktokContent)
      expect(result.valid).toBe(true)
    })
  })

  describe('publish', () => {
    it('returns successful publish by default', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      const result = await adapter.publish(validRedditContent)
      expect(result.success).toBe(true)
      expect(result.platform).toBe('reddit')
      expect(result.itemId).toBe('item-1')
      expect(result.postId).toBeDefined()
      expect(result.postUrl).toBeDefined()
      expect(result.publishedAt).toBeDefined()
    })

    it('returns failure publish when configured', async () => {
      const adapter = new StubAdapter({platform: 'tiktok', shouldFailPublish: true})
      const result = await adapter.publish(validTiktokContent)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.classification).toBe('transient')
      expect(result.error!.retryable).toBe(true)
    })

    it('merges custom publish result fields', async () => {
      const adapter = new StubAdapter({
        platform: 'facebook',
        publishResult: {postId: 'custom-id', postUrl: 'https://facebook.com/custom'},
      })
      const content: PlatformContent = {
        itemId: 'item-fb',
        platform: 'facebook',
        content: {body: 'Hello', platformMeta: {}},
      }
      const result = await adapter.publish(content)
      expect(result.postId).toBe('custom-id')
      expect(result.postUrl).toBe('https://facebook.com/custom')
    })
  })

  describe('getMetrics', () => {
    it('returns default metrics', async () => {
      const adapter = new StubAdapter({platform: 'instagram'})
      const metrics = await adapter.getMetrics('post-123')
      expect(metrics.postId).toBe('post-123')
      expect(metrics.platform).toBe('instagram')
      expect(metrics.views).toBe(100)
      expect(metrics.likes).toBe(10)
      expect(metrics.engagementRate).toBe(0.17)
      expect(metrics.retrievedAt).toBeDefined()
    })

    it('merges custom metrics fields', async () => {
      const adapter = new StubAdapter({
        platform: 'reddit',
        metricsResult: {views: 5000, likes: 200},
      })
      const metrics = await adapter.getMetrics('post-abc')
      expect(metrics.views).toBe(5000)
      expect(metrics.likes).toBe(200)
      expect(metrics.comments).toBe(5) // default
    })
  })

  describe('getRateLimits', () => {
    it('returns default rate limits', async () => {
      const adapter = new StubAdapter({platform: 'tiktok'})
      const limits = await adapter.getRateLimits()
      expect(limits.platform).toBe('tiktok')
      expect(limits.remaining).toBe(50)
      expect(limits.limit).toBe(60)
      expect(limits.windowType).toBe('minute')
      expect(limits.resetsAt).toBeDefined()
    })

    it('merges custom rate limit fields', async () => {
      const adapter = new StubAdapter({
        platform: 'instagram',
        rateLimitResult: {remaining: 0, limit: 200, windowType: 'hour' as const},
      })
      const limits = await adapter.getRateLimits()
      expect(limits.remaining).toBe(0)
      expect(limits.limit).toBe(200)
      expect(limits.windowType).toBe('hour')
    })
  })

  describe('disconnect', () => {
    it('resolves without error', async () => {
      const adapter = new StubAdapter({platform: 'facebook'})
      await expect(adapter.disconnect()).resolves.toBeUndefined()
    })
  })

  describe('platform property', () => {
    it('returns the configured platform', () => {
      const adapter = new StubAdapter({platform: 'instagram'})
      expect(adapter.platform).toBe('instagram')
    })
  })
})
