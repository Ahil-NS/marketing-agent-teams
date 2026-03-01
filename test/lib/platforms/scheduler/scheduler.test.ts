import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

import type {PlatformContent, PlatformMetrics} from '../../../../src/lib/platforms/types.js'
import {RateLimitTracker} from '../../../../src/lib/platforms/rate-limiter.js'
import {
  ContentScheduler,
  getScheduleStatus,
  DEFAULT_PLATFORM_SCHEDULE,
  TimingAnalyzer,
  MIN_DATA_POINTS,
} from '../../../../src/lib/platforms/scheduler/index.js'
import type {PlatformScheduleConfig, ScheduleSlot} from '../../../../src/lib/platforms/scheduler/index.js'

function makeItem(id: string, platform: PlatformContent['platform'] = 'reddit'): PlatformContent {
  return {
    itemId: id,
    platform,
    content: {
      body: `Test content ${id}`,
      platformMeta: {},
    },
  }
}

function makeMetrics(
  dayOfWeek: number,
  hourUtc: number,
  engagementRate: number,
  index = 0,
): PlatformMetrics {
  const date = new Date('2026-03-01T00:00:00Z')
  const currentDay = date.getUTCDay()
  const diff = (dayOfWeek - currentDay + 7) % 7
  date.setUTCDate(date.getUTCDate() + diff)
  date.setUTCHours(hourUtc, 0, 0, 0)

  return {
    postId: `post-${dayOfWeek}-${hourUtc}-${index}`,
    platform: 'reddit',
    engagementRate,
    retrievedAt: date.toISOString(),
  }
}

describe('ContentScheduler', () => {
  // Fix time to Sunday March 1, 2026 00:00:00 UTC
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('schedule with publishNow', () => {
    it('assigns current timestamp to all items', () => {
      const scheduler = new ContentScheduler()
      const items = [makeItem('1'), makeItem('2')]

      const result = scheduler.schedule(items, {publishNow: true})

      expect(result.scheduled).toHaveLength(2)
      expect(result.skipped).toHaveLength(0)
      for (const s of result.scheduled) {
        expect(s.source).toBe('immediate')
        expect(s.scheduledTime).toBe('2026-03-01T00:00:00.000Z')
      }
    })

    it('sets scheduledTime on PlatformContent items directly', () => {
      const scheduler = new ContentScheduler()
      const items = [makeItem('1')]

      scheduler.schedule(items, {publishNow: true})

      expect(items[0].scheduledTime).toBe('2026-03-01T00:00:00.000Z')
    })

    it('skips items when rate limit exceeded', () => {
      const rateLimiter = new RateLimitTracker({defaultSafetyThreshold: 5})
      // Simulate exhausted rate limit
      rateLimiter.updateFromHeaders('reddit', {
        'x-ratelimit-remaining': '2',
        'x-ratelimit-used': '58',
        'x-ratelimit-reset': '60',
      })

      const scheduler = new ContentScheduler({rateLimiter})
      const items = [makeItem('1')]

      const result = scheduler.schedule(items, {publishNow: true})

      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0].reason).toContain('Rate limit')
      expect(result.scheduled).toHaveLength(0)
    })
  })

  describe('schedule with defaults (no engagement data)', () => {
    it('assigns time slots from default schedule', () => {
      const scheduler = new ContentScheduler()
      const items = [makeItem('1')]

      const result = scheduler.schedule(items)

      expect(result.scheduled).toHaveLength(1)
      expect(result.scheduled[0].source).toBe('default')
      expect(result.scheduled[0].scheduledTime).toBeDefined()
      // Verify it's in the future
      expect(new Date(result.scheduled[0].scheduledTime).getTime()).toBeGreaterThan(Date.now())
    })

    it('uses user config overrides when provided', () => {
      const customConfig: Partial<Record<'reddit', Partial<PlatformScheduleConfig>>> = {
        reddit: {
          preferredSlots: [{dayOfWeek: [0], hourUtc: 5, label: 'Custom slot'}],
          minGapMinutes: 15,
        },
      }

      const scheduler = new ContentScheduler({config: customConfig})
      const items = [makeItem('1')]

      const result = scheduler.schedule(items)

      expect(result.scheduled).toHaveLength(1)
      // Should be scheduled for Sunday (today) at 05:00 UTC
      const scheduledDate = new Date(result.scheduled[0].scheduledTime)
      expect(scheduledDate.getUTCDay()).toBe(0) // Sunday
      expect(scheduledDate.getUTCHours()).toBe(5)
    })
  })

  describe('schedule with engagement data', () => {
    it('uses engagement-based slots when sufficient data exists', () => {
      const scheduler = new ContentScheduler()
      const items = [makeItem('1')]

      // Create enough data for engagement analysis — Monday at 10:00
      const metrics = Array.from({length: MIN_DATA_POINTS}, (_, i) =>
        makeMetrics(1, 10, 0.15, i),
      )

      const result = scheduler.schedule(items, {publishNow: false}, {reddit: metrics})

      expect(result.scheduled).toHaveLength(1)
      expect(result.scheduled[0].source).toBe('engagement')
    })

    it('falls back to defaults when insufficient engagement data', () => {
      const scheduler = new ContentScheduler()
      const items = [makeItem('1')]

      const metrics = Array.from({length: MIN_DATA_POINTS - 1}, (_, i) =>
        makeMetrics(1, 10, 0.15, i),
      )

      const result = scheduler.schedule(items, {publishNow: false}, {reddit: metrics})

      expect(result.scheduled).toHaveLength(1)
      expect(result.scheduled[0].source).toBe('default')
    })
  })

  describe('multi-item spacing', () => {
    it('spaces items on same platform by minimum gap', () => {
      const scheduler = new ContentScheduler({
        config: {
          reddit: {
            preferredSlots: [
              {dayOfWeek: [0, 1, 2, 3, 4, 5, 6], hourUtc: 5, label: 'Available'},
            ],
            minGapMinutes: 30,
          },
        },
      })
      const items = [makeItem('1'), makeItem('2'), makeItem('3')]

      const result = scheduler.schedule(items)

      expect(result.scheduled).toHaveLength(3)

      const times = result.scheduled.map((s) => new Date(s.scheduledTime).getTime())
      for (let i = 1; i < times.length; i++) {
        const gapMs = times[i] - times[i - 1]
        expect(gapMs).toBeGreaterThanOrEqual(30 * 60 * 1000)
      }
    })

    it('respects custom minGapMinutes from options', () => {
      const scheduler = new ContentScheduler({
        config: {
          reddit: {
            preferredSlots: [
              {dayOfWeek: [0, 1, 2, 3, 4, 5, 6], hourUtc: 5, label: 'Available'},
            ],
            minGapMinutes: 30,
          },
        },
      })
      const items = [makeItem('1'), makeItem('2')]

      const result = scheduler.schedule(items, {publishNow: false, minGapMinutes: 60})

      expect(result.scheduled).toHaveLength(2)
      const gap =
        new Date(result.scheduled[1].scheduledTime).getTime() -
        new Date(result.scheduled[0].scheduledTime).getTime()
      expect(gap).toBeGreaterThanOrEqual(60 * 60 * 1000)
    })
  })

  describe('schedule persistence', () => {
    it('sets scheduledTime on PlatformContent items', () => {
      const scheduler = new ContentScheduler()
      const items = [makeItem('1'), makeItem('2')]

      scheduler.schedule(items)

      for (const item of items) {
        expect(item.scheduledTime).toBeDefined()
        expect(typeof item.scheduledTime).toBe('string')
        // Valid ISO 8601
        expect(new Date(item.scheduledTime!).toISOString()).toBe(item.scheduledTime)
      }
    })
  })

  describe('rate limit integration', () => {
    it('skips all items for rate-limited platform', () => {
      const rateLimiter = new RateLimitTracker({defaultSafetyThreshold: 5})
      rateLimiter.updateFromHeaders('reddit', {
        'x-ratelimit-remaining': '2',
        'x-ratelimit-used': '58',
        'x-ratelimit-reset': '60',
      })

      const scheduler = new ContentScheduler({rateLimiter})
      const items = [makeItem('1'), makeItem('2')]

      const result = scheduler.schedule(items)

      expect(result.skipped).toHaveLength(2)
      expect(result.scheduled).toHaveLength(0)
    })

    it('schedules items for non-rate-limited platforms', () => {
      const rateLimiter = new RateLimitTracker({defaultSafetyThreshold: 5})
      // Reddit exhausted
      rateLimiter.updateFromHeaders('reddit', {
        'x-ratelimit-remaining': '2',
        'x-ratelimit-used': '58',
        'x-ratelimit-reset': '60',
      })

      const scheduler = new ContentScheduler({rateLimiter})
      const items = [makeItem('1', 'reddit'), makeItem('2', 'tiktok')]

      const result = scheduler.schedule(items)

      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0].platform).toBe('reddit')
      expect(result.scheduled).toHaveLength(1)
      expect(result.scheduled[0].platform).toBe('tiktok')
    })
  })

  describe('multi-platform scheduling', () => {
    it('schedules items for different platforms independently', () => {
      const scheduler = new ContentScheduler()
      const items = [
        makeItem('1', 'reddit'),
        makeItem('2', 'tiktok'),
        makeItem('3', 'facebook'),
      ]

      const result = scheduler.schedule(items)

      expect(result.scheduled).toHaveLength(3)
      // Each should be on the right platform
      expect(result.scheduled.find((s) => s.platform === 'reddit')).toBeDefined()
      expect(result.scheduled.find((s) => s.platform === 'tiktok')).toBeDefined()
      expect(result.scheduled.find((s) => s.platform === 'facebook')).toBeDefined()
    })
  })
})

describe('getScheduleStatus', () => {
  it('returns empty status when no items have scheduledTime', () => {
    const items = [makeItem('1'), makeItem('2')]
    const status = getScheduleStatus(items)

    expect(status.nextPublishAt).toBeNull()
    expect(status.byPlatform).toEqual({})
    expect(status.upcomingItems).toEqual([])
  })

  it('returns correct next publish time', () => {
    const items = [
      {...makeItem('1'), scheduledTime: '2026-03-01T14:00:00Z'},
      {...makeItem('2'), scheduledTime: '2026-03-01T10:00:00Z'},
    ]

    const status = getScheduleStatus(items)

    expect(status.nextPublishAt).toBe('2026-03-01T10:00:00Z')
  })

  it('returns per-platform queue depth', () => {
    const items = [
      {...makeItem('1', 'reddit'), scheduledTime: '2026-03-01T14:00:00Z'},
      {...makeItem('2', 'reddit'), scheduledTime: '2026-03-01T15:00:00Z'},
      {...makeItem('3', 'tiktok'), scheduledTime: '2026-03-01T16:00:00Z'},
    ]

    const status = getScheduleStatus(items)

    expect(status.byPlatform.reddit?.queued).toBe(2)
    expect(status.byPlatform.reddit?.nextAt).toBe('2026-03-01T14:00:00Z')
    expect(status.byPlatform.tiktok?.queued).toBe(1)
    expect(status.byPlatform.tiktok?.nextAt).toBe('2026-03-01T16:00:00Z')
  })

  it('returns upcoming items sorted by scheduledTime ascending', () => {
    const items = [
      {...makeItem('3'), scheduledTime: '2026-03-01T20:00:00Z'},
      {...makeItem('1'), scheduledTime: '2026-03-01T10:00:00Z'},
      {...makeItem('2'), scheduledTime: '2026-03-01T15:00:00Z'},
    ]

    const status = getScheduleStatus(items)

    expect(status.upcomingItems).toHaveLength(3)
    expect(status.upcomingItems[0].itemId).toBe('1')
    expect(status.upcomingItems[1].itemId).toBe('2')
    expect(status.upcomingItems[2].itemId).toBe('3')
  })

  it('ignores items without scheduledTime', () => {
    const items = [
      {...makeItem('1'), scheduledTime: '2026-03-01T14:00:00Z'},
      makeItem('2'), // no scheduledTime
    ]

    const status = getScheduleStatus(items)

    expect(status.upcomingItems).toHaveLength(1)
    expect(status.upcomingItems[0].itemId).toBe('1')
  })
})

describe('DEFAULT_PLATFORM_SCHEDULE', () => {
  it('has configs for all platforms', () => {
    expect(DEFAULT_PLATFORM_SCHEDULE.reddit).toBeDefined()
    expect(DEFAULT_PLATFORM_SCHEDULE.tiktok).toBeDefined()
    expect(DEFAULT_PLATFORM_SCHEDULE.facebook).toBeDefined()
    expect(DEFAULT_PLATFORM_SCHEDULE.instagram).toBeDefined()
  })

  it('has preferred slots for each platform', () => {
    for (const config of Object.values(DEFAULT_PLATFORM_SCHEDULE)) {
      expect(config.preferredSlots.length).toBeGreaterThan(0)
      expect(config.minGapMinutes).toBeGreaterThan(0)
      for (const slot of config.preferredSlots) {
        expect(slot.dayOfWeek.length).toBeGreaterThan(0)
        expect(slot.hourUtc).toBeGreaterThanOrEqual(0)
        expect(slot.hourUtc).toBeLessThanOrEqual(23)
      }
    }
  })

  it('uses wider gap for tiktok (rate-limited platform)', () => {
    expect(DEFAULT_PLATFORM_SCHEDULE.tiktok.minGapMinutes).toBeGreaterThan(
      DEFAULT_PLATFORM_SCHEDULE.reddit.minGapMinutes,
    )
  })
})
