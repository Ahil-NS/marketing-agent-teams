import type {PlatformContent, PlatformMetrics, PlatformName} from '../types.js'
import type {RateLimitTracker} from '../rate-limiter.js'

import {TimingAnalyzer} from './timing-analyzer.js'
import type {
  PlatformScheduleConfig,
  ScheduleOptions,
  ScheduleResult,
  ScheduleSlot,
  ScheduleStatus,
  ScheduledItem,
  ScheduledItemSummary,
  SkippedItem,
} from './types.js'
import {DEFAULT_PLATFORM_SCHEDULE} from './types.js'

const DEFAULT_MIN_GAP_MINUTES = 30

/**
 * Assigns optimal scheduledTime to PlatformContent items based on
 * engagement data, default timing, rate limits, and spacing rules.
 *
 * Does NOT publish — the distribution stage checks `scheduledTime <= now`.
 */
export class ContentScheduler {
  private readonly timingAnalyzer: TimingAnalyzer
  private readonly config: Record<PlatformName, PlatformScheduleConfig>
  private readonly rateLimiter: RateLimitTracker | undefined

  constructor(options?: {
    rateLimiter?: RateLimitTracker
    timingAnalyzer?: TimingAnalyzer
    config?: Partial<Record<PlatformName, Partial<PlatformScheduleConfig>>>
  }) {
    this.rateLimiter = options?.rateLimiter
    this.timingAnalyzer = options?.timingAnalyzer ?? new TimingAnalyzer()
    this.config = mergeConfig(options?.config)
  }

  /**
   * Schedule content items for publishing.
   *
   * When `publishNow` is true, all items get current timestamp (rate limits still enforced).
   * Otherwise, assigns optimal time slots based on engagement data or defaults.
   */
  schedule(
    items: PlatformContent[],
    options: ScheduleOptions = {publishNow: false},
    engagementData?: Partial<Record<PlatformName, PlatformMetrics[]>>,
  ): ScheduleResult {
    if (options.publishNow) {
      return this.scheduleImmediate(items)
    }

    return this.scheduleOptimal(items, options, engagementData)
  }

  private scheduleImmediate(items: PlatformContent[]): ScheduleResult {
    const now = new Date().toISOString()
    const scheduled: ScheduledItem[] = []
    const skipped: SkippedItem[] = []

    for (const item of items) {
      if (this.rateLimiter) {
        const quota = this.rateLimiter.checkQuota(item.platform)
        if (!quota.allowed) {
          skipped.push({
            itemId: item.itemId,
            platform: item.platform,
            reason: `Rate limit exceeded, resets in ${quota.waitMs}ms`,
          })
          continue
        }
      }

      item.scheduledTime = now
      scheduled.push({
        itemId: item.itemId,
        platform: item.platform,
        scheduledTime: now,
        source: 'immediate',
      })
    }

    return {scheduled, skipped}
  }

  private scheduleOptimal(
    items: PlatformContent[],
    options: ScheduleOptions,
    engagementData?: Partial<Record<PlatformName, PlatformMetrics[]>>,
  ): ScheduleResult {
    const scheduled: ScheduledItem[] = []
    const skipped: SkippedItem[] = []

    // Group items by platform for spacing enforcement
    const byPlatform = new Map<PlatformName, PlatformContent[]>()
    for (const item of items) {
      const group = byPlatform.get(item.platform) ?? []
      group.push(item)
      byPlatform.set(item.platform, group)
    }

    for (const [platform, platformItems] of byPlatform) {
      const config = this.config[platform]
      const minGapMinutes = options.minGapMinutes ?? config.minGapMinutes ?? DEFAULT_MIN_GAP_MINUTES

      // Determine available slots
      let slots: ScheduleSlot[]
      let source: 'engagement' | 'default' = 'default'

      if (engagementData?.[platform]) {
        const analyzed = this.timingAnalyzer.analyzeEngagement(platform, engagementData[platform])
        if (analyzed.length > 0) {
          slots = analyzed
          source = 'engagement'
        } else {
          slots = config.preferredSlots
        }
      } else {
        slots = config.preferredSlots
      }

      // Rate limit check
      if (this.rateLimiter) {
        const quota = this.rateLimiter.checkQuota(platform)
        if (!quota.allowed) {
          for (const item of platformItems) {
            skipped.push({
              itemId: item.itemId,
              platform,
              reason: `Rate limit exceeded, resets in ${quota.waitMs}ms`,
            })
          }

          continue
        }
      }

      // Assign times with spacing
      const now = new Date()
      let lastScheduledTime: Date | null = null

      for (const item of platformItems) {
        const candidateTime = findNextSlot(slots, now, lastScheduledTime, minGapMinutes)

        if (!candidateTime) {
          skipped.push({
            itemId: item.itemId,
            platform,
            reason: 'No available time slots for today',
          })
          continue
        }

        item.scheduledTime = candidateTime.toISOString()
        scheduled.push({
          itemId: item.itemId,
          platform,
          scheduledTime: item.scheduledTime,
          source,
        })
        lastScheduledTime = candidateTime
      }
    }

    return {scheduled, skipped}
  }
}

/**
 * Get schedule status for a set of content items that have scheduledTime set.
 */
export function getScheduleStatus(items: PlatformContent[]): ScheduleStatus {
  const scheduledItems = items.filter((i) => i.scheduledTime)

  if (scheduledItems.length === 0) {
    return {
      nextPublishAt: null,
      byPlatform: {},
      upcomingItems: [],
    }
  }

  // Sort by scheduledTime ascending
  const sorted = [...scheduledItems].sort((a, b) => a.scheduledTime!.localeCompare(b.scheduledTime!))

  const nextPublishAt = sorted[0].scheduledTime!

  // Group by platform
  const byPlatform: ScheduleStatus['byPlatform'] = {}
  for (const item of sorted) {
    const existing = byPlatform[item.platform]
    if (existing) {
      existing.queued++
    } else {
      byPlatform[item.platform] = {
        queued: 1,
        nextAt: item.scheduledTime!,
      }
    }
  }

  const upcomingItems: ScheduledItemSummary[] = sorted.map((item) => ({
    itemId: item.itemId,
    platform: item.platform,
    scheduledTime: item.scheduledTime!,
  }))

  return {nextPublishAt, byPlatform, upcomingItems}
}

// --- Helpers ---

/**
 * Merge user config overrides with defaults. User slots take precedence.
 */
function mergeConfig(
  userConfig?: Partial<Record<PlatformName, Partial<PlatformScheduleConfig>>>,
): Record<PlatformName, PlatformScheduleConfig> {
  const merged = {...DEFAULT_PLATFORM_SCHEDULE}

  if (!userConfig) return merged

  for (const [platform, overrides] of Object.entries(userConfig) as Array<
    [PlatformName, Partial<PlatformScheduleConfig>]
  >) {
    if (merged[platform] && overrides) {
      merged[platform] = {
        preferredSlots: overrides.preferredSlots ?? merged[platform].preferredSlots,
        minGapMinutes: overrides.minGapMinutes ?? merged[platform].minGapMinutes,
      }
    }
  }

  return merged
}

/**
 * Find the next available time slot considering current time, last scheduled time,
 * and minimum gap between posts. Scans up to 7 days ahead.
 */
function findNextSlot(
  slots: ScheduleSlot[],
  now: Date,
  lastScheduled: Date | null,
  minGapMinutes: number,
): Date | null {
  // Try slots for today and the next 6 days (7 days total)
  const MAX_DAYS_AHEAD = 7

  for (let dayOffset = 0; dayOffset < MAX_DAYS_AHEAD; dayOffset++) {
    const candidateDate = new Date(now)
    candidateDate.setUTCDate(candidateDate.getUTCDate() + dayOffset)
    const dayOfWeek = candidateDate.getUTCDay()

    for (const slot of slots) {
      if (!slot.dayOfWeek.includes(dayOfWeek)) {
        continue
      }

      const candidate = new Date(candidateDate)
      candidate.setUTCHours(slot.hourUtc, 0, 0, 0)

      // Skip if in the past
      if (candidate <= now) {
        continue
      }

      // Check minimum gap
      if (lastScheduled) {
        const gapMs = candidate.getTime() - lastScheduled.getTime()
        const gapMinutes = gapMs / (1000 * 60)
        if (gapMinutes < minGapMinutes) {
          // Shift to satisfy gap
          const shifted = new Date(lastScheduled.getTime() + minGapMinutes * 60 * 1000)
          // Only use shifted time if it's still in the future
          if (shifted > now) {
            return shifted
          }

          continue
        }
      }

      return candidate
    }
  }

  return null
}
