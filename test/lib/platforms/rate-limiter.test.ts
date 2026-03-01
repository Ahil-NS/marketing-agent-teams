import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {RateLimitTracker} from '../../../src/lib/platforms/rate-limiter.js'

describe('RateLimitTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('creates with default safety threshold of 5', () => {
      const tracker = new RateLimitTracker()
      // No state yet → allowed
      expect(tracker.checkQuota('reddit')).toEqual({allowed: true, waitMs: 0})
    })

    it('accepts custom default safety threshold', () => {
      const tracker = new RateLimitTracker({defaultSafetyThreshold: 10})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '8',
        'X-Ratelimit-Used': '52',
        'X-Ratelimit-Reset': '300',
      })
      // 8 remaining <= 10 threshold → not allowed
      expect(tracker.checkQuota('reddit').allowed).toBe(false)
    })

    it('accepts per-platform safety thresholds', () => {
      const tracker = new RateLimitTracker({safetyThresholds: {reddit: 2, tiktok: 1}})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '3',
        'X-Ratelimit-Used': '57',
        'X-Ratelimit-Reset': '300',
      })
      // 3 remaining > 2 threshold → allowed
      expect(tracker.checkQuota('reddit').allowed).toBe(true)
    })
  })

  describe('updateFromHeaders - Reddit', () => {
    it('parses Reddit rate limit headers', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '45.0',
        'X-Ratelimit-Used': '15',
        'X-Ratelimit-Reset': '300',
      })

      const status = tracker.getStatus('reddit')
      expect(status).toBeDefined()
      expect(status!.remaining).toBe(45)
      expect(status!.limit).toBe(60)
      expect(status!.windowType).toBe('minute')
      expect(status!.platform).toBe('reddit')
    })

    it('handles case-insensitive headers', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('reddit', {
        'x-ratelimit-remaining': '30',
        'x-ratelimit-used': '30',
        'x-ratelimit-reset': '120',
      })

      const status = tracker.getStatus('reddit')
      expect(status).toBeDefined()
      expect(status!.remaining).toBe(30)
    })

    it('calculates reset time from seconds offset', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '50',
        'X-Ratelimit-Used': '10',
        'X-Ratelimit-Reset': '600',
      })

      const status = tracker.getStatus('reddit')!
      const resetTime = new Date(status.resetsAt).getTime()
      const now = Date.now()
      // Should reset ~600 seconds from now
      expect(resetTime - now).toBeCloseTo(600_000, -2)
    })

    it('ignores headers when neither remaining nor used present', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('reddit', {'X-Other': 'value'})
      expect(tracker.getStatus('reddit')).toBeUndefined()
    })
  })

  describe('updateFromHeaders - Facebook/Instagram (Meta)', () => {
    it('parses Facebook x-app-usage header', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('facebook', {
        'x-app-usage': JSON.stringify({call_count: 25, total_cputime: 10, total_time: 15}),
      })

      const status = tracker.getStatus('facebook')
      expect(status).toBeDefined()
      expect(status!.remaining).toBe(150) // 200 * (1 - 25/100) = 150
      expect(status!.limit).toBe(200)
      expect(status!.windowType).toBe('hour')
    })

    it('parses Instagram x-app-usage header (shared Meta quota)', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('instagram', {
        'x-app-usage': JSON.stringify({call_count: 80, total_cputime: 5, total_time: 10}),
      })

      const status = tracker.getStatus('instagram')
      expect(status).toBeDefined()
      // max percent = max(80, 10) = 80 → remaining = 200 * (1 - 0.8) = 40
      expect(status!.remaining).toBe(40)
    })

    it('uses max of call_count and total_time percentage', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('facebook', {
        'x-app-usage': JSON.stringify({call_count: 20, total_time: 60}),
      })

      const status = tracker.getStatus('facebook')!
      // max(20, 60) = 60 → remaining = 200 * (1 - 0.6) = 80
      expect(status.remaining).toBe(80)
    })

    it('handles 100% usage as 0 remaining', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('facebook', {
        'x-app-usage': JSON.stringify({call_count: 100, total_time: 100}),
      })

      const status = tracker.getStatus('facebook')!
      expect(status.remaining).toBe(0)
    })

    it('ignores invalid JSON in x-app-usage', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('facebook', {'x-app-usage': 'invalid-json'})
      expect(tracker.getStatus('facebook')).toBeUndefined()
    })

    it('ignores missing x-app-usage header', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('facebook', {'X-Other': 'value'})
      expect(tracker.getStatus('facebook')).toBeUndefined()
    })
  })

  describe('updateFromHeaders - TikTok', () => {
    it('parses TikTok rate limit headers', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('tiktok', {
        'X-RateLimit-Remaining': '4',
        'X-RateLimit-Limit': '6',
        'X-RateLimit-Reset': '60',
      })

      const status = tracker.getStatus('tiktok')
      expect(status).toBeDefined()
      expect(status!.remaining).toBe(4)
      expect(status!.limit).toBe(6)
      expect(status!.windowType).toBe('minute')
    })

    it('handles epoch timestamp reset', () => {
      const tracker = new RateLimitTracker()
      const futureEpoch = Math.floor(Date.now() / 1000) + 120
      tracker.updateFromHeaders('tiktok', {
        'X-RateLimit-Remaining': '3',
        'X-RateLimit-Limit': '6',
        'X-RateLimit-Reset': String(futureEpoch),
      })

      const status = tracker.getStatus('tiktok')!
      const resetTime = new Date(status.resetsAt).getTime()
      expect(resetTime).toBeCloseTo(futureEpoch * 1000, -2)
    })

    it('defaults limit to 6 when not provided', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('tiktok', {
        'X-RateLimit-Remaining': '2',
      })

      const status = tracker.getStatus('tiktok')!
      expect(status.limit).toBe(6)
    })

    it('ignores headers when neither remaining nor limit present', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('tiktok', {'X-Other': 'value'})
      expect(tracker.getStatus('tiktok')).toBeUndefined()
    })
  })

  describe('checkQuota', () => {
    it('allows requests when no state tracked', () => {
      const tracker = new RateLimitTracker()
      expect(tracker.checkQuota('reddit')).toEqual({allowed: true, waitMs: 0})
    })

    it('allows requests when remaining > threshold', () => {
      const tracker = new RateLimitTracker({defaultSafetyThreshold: 5})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '10',
        'X-Ratelimit-Used': '50',
        'X-Ratelimit-Reset': '300',
      })
      expect(tracker.checkQuota('reddit')).toEqual({allowed: true, waitMs: 0})
    })

    it('blocks requests when remaining <= threshold', () => {
      const tracker = new RateLimitTracker({defaultSafetyThreshold: 5})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '5',
        'X-Ratelimit-Used': '55',
        'X-Ratelimit-Reset': '300',
      })

      const check = tracker.checkQuota('reddit')
      expect(check.allowed).toBe(false)
      expect(check.waitMs).toBeGreaterThan(0)
      // Wait should be approximately 300 seconds
      expect(check.waitMs).toBeCloseTo(300_000, -2)
    })

    it('blocks requests when remaining is 0', () => {
      const tracker = new RateLimitTracker({defaultSafetyThreshold: 5})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '0',
        'X-Ratelimit-Used': '60',
        'X-Ratelimit-Reset': '120',
      })

      const check = tracker.checkQuota('reddit')
      expect(check.allowed).toBe(false)
      expect(check.waitMs).toBeCloseTo(120_000, -2)
    })

    it('returns waitMs of 0 when reset is in the past', () => {
      const tracker = new RateLimitTracker({defaultSafetyThreshold: 5})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '3',
        'X-Ratelimit-Used': '57',
        'X-Ratelimit-Reset': '0',
      })

      const check = tracker.checkQuota('reddit')
      expect(check.allowed).toBe(false)
      expect(check.waitMs).toBe(0)
    })
  })

  describe('throttle', () => {
    it('returns immediately when quota is available', async () => {
      const tracker = new RateLimitTracker()
      await tracker.throttle('reddit') // No state tracked — no waiting
    })

    it('waits until rate limit resets when below threshold', async () => {
      const tracker = new RateLimitTracker({defaultSafetyThreshold: 5})
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '2',
        'X-Ratelimit-Used': '58',
        'X-Ratelimit-Reset': '60',
      })

      let throttleResolved = false
      const throttlePromise = tracker.throttle('reddit').then(() => {
        throttleResolved = true
      })

      // Should not have resolved yet
      expect(throttleResolved).toBe(false)

      // Advance past the wait time
      await vi.advanceTimersByTimeAsync(61_000)
      await throttlePromise

      expect(throttleResolved).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('returns undefined for untracked platform', () => {
      const tracker = new RateLimitTracker()
      expect(tracker.getStatus('reddit')).toBeUndefined()
    })

    it('returns RateLimitStatus for tracked platform', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '40',
        'X-Ratelimit-Used': '20',
        'X-Ratelimit-Reset': '300',
      })

      const status = tracker.getStatus('reddit')!
      expect(status.platform).toBe('reddit')
      expect(status.remaining).toBe(40)
      expect(status.limit).toBe(60)
      expect(status.windowType).toBe('minute')
      expect(status.resetsAt).toBeTruthy()
    })
  })

  describe('getAllStatus', () => {
    it('returns empty array when nothing tracked', () => {
      const tracker = new RateLimitTracker()
      expect(tracker.getAllStatus()).toEqual([])
    })

    it('returns status for all tracked platforms', () => {
      const tracker = new RateLimitTracker()
      tracker.updateFromHeaders('reddit', {
        'X-Ratelimit-Remaining': '40',
        'X-Ratelimit-Used': '20',
        'X-Ratelimit-Reset': '300',
      })
      tracker.updateFromHeaders('facebook', {
        'x-app-usage': JSON.stringify({call_count: 30, total_time: 20}),
      })

      const all = tracker.getAllStatus()
      expect(all).toHaveLength(2)
      expect(all.map((s) => s.platform)).toContain('reddit')
      expect(all.map((s) => s.platform)).toContain('facebook')
    })
  })
})
