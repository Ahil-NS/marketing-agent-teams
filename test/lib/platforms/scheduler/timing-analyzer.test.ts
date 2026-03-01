import {describe, it, expect} from 'vitest'

import type {PlatformMetrics} from '../../../../src/lib/platforms/types.js'
import {TimingAnalyzer, MIN_DATA_POINTS} from '../../../../src/lib/platforms/scheduler/index.js'

function makeMetrics(
  dayOfWeek: number,
  hourUtc: number,
  engagementRate: number,
  index = 0,
): PlatformMetrics {
  // Build a date for the given day and hour
  const date = new Date('2026-03-01T00:00:00Z')
  // Adjust to the right day of week (March 1 2026 is a Sunday = 0)
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

describe('TimingAnalyzer', () => {
  const analyzer = new TimingAnalyzer()

  describe('analyzeEngagement', () => {
    it('returns empty array when fewer than MIN_DATA_POINTS metrics provided', () => {
      const metrics = Array.from({length: MIN_DATA_POINTS - 1}, (_, i) =>
        makeMetrics(1, 14, 0.05, i),
      )
      const result = analyzer.analyzeEngagement('reddit', metrics)
      expect(result).toEqual([])
    })

    it('returns empty array for exactly 0 metrics', () => {
      const result = analyzer.analyzeEngagement('reddit', [])
      expect(result).toEqual([])
    })

    it('returns slots when exactly MIN_DATA_POINTS metrics provided', () => {
      const metrics = Array.from({length: MIN_DATA_POINTS}, (_, i) =>
        makeMetrics(1, 14, 0.05, i),
      )
      const result = analyzer.analyzeEngagement('reddit', metrics)
      expect(result.length).toBeGreaterThan(0)
    })

    it('groups metrics by day-of-week and hour', () => {
      const metrics = [
        // Monday 14:00 - 5 data points
        ...Array.from({length: 5}, (_, i) => makeMetrics(1, 14, 0.08, i)),
        // Wednesday 10:00 - 5 data points
        ...Array.from({length: 5}, (_, i) => makeMetrics(3, 10, 0.12, i + 5)),
      ]
      const result = analyzer.analyzeEngagement('reddit', metrics)

      expect(result.length).toBe(2)
      // Wednesday 10:00 should rank higher (0.12 > 0.08)
      expect(result[0].dayOfWeek).toEqual([3])
      expect(result[0].hourUtc).toBe(10)
      expect(result[1].dayOfWeek).toEqual([1])
      expect(result[1].hourUtc).toBe(14)
    })

    it('ranks by average engagement rate', () => {
      const metrics = [
        ...Array.from({length: 5}, (_, i) => makeMetrics(1, 14, 0.02, i)),     // Low engagement
        ...Array.from({length: 5}, (_, i) => makeMetrics(2, 9, 0.20, i + 5)),   // High engagement
      ]
      const result = analyzer.analyzeEngagement('reddit', metrics)

      expect(result[0].hourUtc).toBe(9)
      expect(result[0].score).toBeCloseTo(0.20)
      expect(result[1].hourUtc).toBe(14)
      expect(result[1].score).toBeCloseTo(0.02)
    })

    it('returns at most 5 top slots', () => {
      // Create data for 7 different day-hour combos
      const metrics: PlatformMetrics[] = []
      for (let day = 0; day < 7; day++) {
        metrics.push(makeMetrics(day, 14, 0.05 + day * 0.01, day))
        // Add extra to meet threshold
        metrics.push(makeMetrics(day, 14, 0.05 + day * 0.01, day + 7))
      }

      const result = analyzer.analyzeEngagement('reddit', metrics)
      expect(result.length).toBeLessThanOrEqual(5)
    })

    it('handles missing engagementRate gracefully (treats as 0)', () => {
      const metrics = Array.from({length: MIN_DATA_POINTS}, (_, i) => ({
        postId: `post-${i}`,
        platform: 'reddit' as const,
        retrievedAt: new Date('2026-03-02T14:00:00Z').toISOString(), // Monday
      }))
      const result = analyzer.analyzeEngagement('reddit', metrics)
      expect(result.length).toBe(1)
      expect(result[0].score).toBe(0)
    })

    it('includes engagement-based label with average', () => {
      const metrics = Array.from({length: MIN_DATA_POINTS}, (_, i) =>
        makeMetrics(1, 14, 0.10, i),
      )
      const result = analyzer.analyzeEngagement('reddit', metrics)
      expect(result[0].label).toContain('Engagement-based')
      expect(result[0].label).toContain('0.10')
    })
  })
})
