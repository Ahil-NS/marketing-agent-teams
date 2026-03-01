import {describe, expect, it} from 'vitest'

import {ViralDetector} from '../../../src/lib/orchestrator/viral-detector.js'
import {DEFAULT_VIRAL_THRESHOLDS} from '../../../src/lib/orchestrator/viral-types.js'
import type {PlatformMetrics} from '../../../src/lib/platforms/types.js'

function makeMetrics(overrides: Partial<PlatformMetrics> & {postId: string; platform: PlatformMetrics['platform']}): PlatformMetrics {
  return {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    engagementRate: 0,
    retrievedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ViralDetector', () => {
  // ── Task 1: Constructor and defaults ──────────────────────────────────────

  describe('constructor', () => {
    it('uses DEFAULT_VIRAL_THRESHOLDS when no overrides provided', () => {
      const detector = new ViralDetector()
      expect(detector.getThresholds('reddit')).toEqual(DEFAULT_VIRAL_THRESHOLDS.reddit)
      expect(detector.getThresholds('tiktok')).toEqual(DEFAULT_VIRAL_THRESHOLDS.tiktok)
      expect(detector.getThresholds('facebook')).toEqual(DEFAULT_VIRAL_THRESHOLDS.facebook)
      expect(detector.getThresholds('instagram')).toEqual(DEFAULT_VIRAL_THRESHOLDS.instagram)
    })

    it('merges user overrides with defaults (AC2)', () => {
      const detector = new ViralDetector({
        reddit: {likes: 1000},
      })
      const thresholds = detector.getThresholds('reddit')
      expect(thresholds?.likes).toBe(1000)
      // Other defaults should remain
      expect(thresholds?.engagementRate).toBe(0.05)
      expect(thresholds?.comments).toBe(100)
    })

    it('user override fully replaces the overridden field only', () => {
      const detector = new ViralDetector({
        tiktok: {views: 50_000, shares: 500},
      })
      const thresholds = detector.getThresholds('tiktok')
      expect(thresholds?.views).toBe(50_000)
      expect(thresholds?.shares).toBe(500)
      // likes should keep default
      expect(thresholds?.likes).toBe(1000)
    })
  })

  // ── Task 1.3: detectViral ─────────────────────────────────────────────────

  describe('detectViral', () => {
    it('flags post exceeding engagementRate threshold (AC1)', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-1', platform: 'reddit', engagementRate: 0.08}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(1)
      expect(results[0].postId).toBe('post-1')
      expect(results[0].platform).toBe('reddit')
      expect(results[0].exceededThresholds).toHaveLength(1)
      expect(results[0].exceededThresholds[0]).toContain('engagementRate')
    })

    it('flags post exceeding likes threshold (AC1)', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-2', platform: 'reddit', likes: 600}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(1)
      expect(results[0].exceededThresholds[0]).toContain('likes')
    })

    it('flags post exceeding views threshold for tiktok', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'tt-1', platform: 'tiktok', views: 15_000}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(1)
      expect(results[0].exceededThresholds[0]).toContain('views')
    })

    it('flags post exceeding comments threshold for facebook', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'fb-1', platform: 'facebook', comments: 55}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(1)
      expect(results[0].exceededThresholds[0]).toContain('comments')
    })

    it('flags post exceeding shares threshold for facebook', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'fb-2', platform: 'facebook', shares: 150}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(1)
      expect(results[0].exceededThresholds[0]).toContain('shares')
    })

    it('does not flag post below all thresholds (AC1)', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-3', platform: 'reddit', likes: 100, comments: 10, engagementRate: 0.01}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(0)
    })

    it('does not flag post exactly at threshold (not exceeding)', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-exact', platform: 'reddit', likes: 500, engagementRate: 0.05, comments: 100}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(0)
    })

    it('flags multiple exceeded thresholds for the same post', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-multi', platform: 'reddit', likes: 1000, engagementRate: 0.1, comments: 200}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(1)
      expect(results[0].exceededThresholds.length).toBeGreaterThanOrEqual(3)
    })

    it('uses user-configured thresholds over defaults (AC2)', () => {
      const detector = new ViralDetector({
        reddit: {likes: 10_000},
      })
      // 600 likes would exceed default (500) but not custom (10000)
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-4', platform: 'reddit', likes: 600}),
      ]
      const results = detector.detectViral(metrics)
      // Should not be flagged for likes, but engagementRate still has default 0.05
      expect(results).toHaveLength(0)
    })

    it('handles missing metric fields gracefully (AC1)', () => {
      const detector = new ViralDetector()
      // Post with no views, likes, etc. defined (only required fields)
      const metrics: PlatformMetrics[] = [
        {postId: 'post-bare', platform: 'reddit', retrievedAt: new Date().toISOString()},
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(0)
    })

    it('processes multiple posts from different platforms', () => {
      const detector = new ViralDetector()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'r-1', platform: 'reddit', likes: 600}),
        makeMetrics({postId: 'tt-2', platform: 'tiktok', views: 5000}),
        makeMetrics({postId: 'ig-1', platform: 'instagram', likes: 2000}),
      ]
      const results = detector.detectViral(metrics)
      expect(results).toHaveLength(2) // reddit (likes>500) and instagram (likes>1000)
      expect(results.map((r) => r.postId)).toEqual(['r-1', 'ig-1'])
    })

    it('returns empty array for empty metrics input', () => {
      const detector = new ViralDetector()
      const results = detector.detectViral([])
      expect(results).toHaveLength(0)
    })

    it('includes correct detectedAt timestamp', () => {
      const detector = new ViralDetector()
      const before = new Date().toISOString()
      const metrics: PlatformMetrics[] = [
        makeMetrics({postId: 'post-ts', platform: 'reddit', likes: 600}),
      ]
      const results = detector.detectViral(metrics)
      const after = new Date().toISOString()
      expect(results[0].detectedAt).toBeDefined()
      expect(results[0].detectedAt >= before).toBe(true)
      expect(results[0].detectedAt <= after).toBe(true)
    })

    it('includes the original metrics in the result', () => {
      const detector = new ViralDetector()
      const originalMetrics = makeMetrics({postId: 'post-m', platform: 'reddit', likes: 600})
      const results = detector.detectViral([originalMetrics])
      expect(results[0].metrics).toEqual(originalMetrics)
    })
  })

  // ── Default thresholds validation ─────────────────────────────────────────

  describe('DEFAULT_VIRAL_THRESHOLDS', () => {
    it('has thresholds for all 4 platforms', () => {
      expect(DEFAULT_VIRAL_THRESHOLDS.reddit).toBeDefined()
      expect(DEFAULT_VIRAL_THRESHOLDS.tiktok).toBeDefined()
      expect(DEFAULT_VIRAL_THRESHOLDS.facebook).toBeDefined()
      expect(DEFAULT_VIRAL_THRESHOLDS.instagram).toBeDefined()
    })

    it('reddit: engagementRate 0.05, likes 500, comments 100', () => {
      expect(DEFAULT_VIRAL_THRESHOLDS.reddit).toEqual({engagementRate: 0.05, likes: 500, comments: 100})
    })

    it('tiktok: views 10000, likes 1000, shares 200', () => {
      expect(DEFAULT_VIRAL_THRESHOLDS.tiktok).toEqual({views: 10_000, likes: 1000, shares: 200})
    })

    it('facebook: engagementRate 0.03, shares 100, comments 50', () => {
      expect(DEFAULT_VIRAL_THRESHOLDS.facebook).toEqual({engagementRate: 0.03, shares: 100, comments: 50})
    })

    it('instagram: engagementRate 0.05, likes 1000, comments 100', () => {
      expect(DEFAULT_VIRAL_THRESHOLDS.instagram).toEqual({engagementRate: 0.05, likes: 1000, comments: 100})
    })
  })
})
