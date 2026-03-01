import type {PlatformMetrics, PlatformName} from '../types.js'

import type {ScheduleSlot} from './types.js'

export const MIN_DATA_POINTS = 10
const TOP_SLOTS_COUNT = 5

/**
 * Analyzes historical engagement data to determine optimal posting times.
 * Groups metrics by day-of-week and hour-of-day, ranking by average engagement rate.
 */
export class TimingAnalyzer {
  /**
   * Analyze engagement metrics to find optimal time slots for a platform.
   * Returns empty array when insufficient data (below MIN_DATA_POINTS),
   * signaling the caller to use default schedule.
   */
  analyzeEngagement(_platform: PlatformName, metrics: PlatformMetrics[]): ScheduleSlot[] {
    if (metrics.length < MIN_DATA_POINTS) {
      return []
    }

    const buckets = new Map<string, {totalEngagement: number; count: number}>()

    for (const m of metrics) {
      const date = new Date(m.retrievedAt)
      const key = `${date.getUTCDay()}-${date.getUTCHours()}`
      const existing = buckets.get(key) ?? {totalEngagement: 0, count: 0}
      existing.totalEngagement += m.engagementRate ?? 0
      existing.count++
      buckets.set(key, existing)
    }

    return Array.from(buckets.entries())
      .map(([key, data]) => {
        const [day, hour] = key.split('-').map(Number)
        const avgEngagement = data.totalEngagement / data.count
        return {
          dayOfWeek: [day],
          hourUtc: hour,
          label: `Engagement-based (avg: ${avgEngagement.toFixed(2)})`,
          score: avgEngagement,
        }
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, TOP_SLOTS_COUNT)
  }
}
