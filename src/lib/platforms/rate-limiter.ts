import type {PlatformName, RateLimitStatus} from './types.js'

export interface RateLimitState {
  remaining: number
  limit: number
  resetsAt: string
  windowType: 'minute' | 'hour' | 'day'
}

export interface RateLimitTrackerOptions {
  safetyThresholds?: Partial<Record<PlatformName, number>>
  defaultSafetyThreshold?: number
}

export interface QuotaCheck {
  allowed: boolean
  waitMs: number
}

/**
 * Tracks per-platform rate limit state and provides throttling.
 * Shared across all platform adapters in a pipeline run.
 */
export class RateLimitTracker {
  private readonly state = new Map<PlatformName, RateLimitState>()
  private readonly safetyThresholds: Partial<Record<PlatformName, number>>
  private readonly defaultSafetyThreshold: number

  constructor(options?: RateLimitTrackerOptions) {
    this.safetyThresholds = options?.safetyThresholds ?? {}
    this.defaultSafetyThreshold = options?.defaultSafetyThreshold ?? 5
  }

  /**
   * Update rate limit state from platform API response headers.
   * Supports Reddit, TikTok, Facebook/Instagram header formats.
   */
  updateFromHeaders(platform: PlatformName, headers: Record<string, string>): void {
    const normalizedHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value
    }

    switch (platform) {
      case 'reddit': {
        this.parseRedditHeaders(platform, normalizedHeaders)
        break
      }

      case 'facebook':
      case 'instagram': {
        this.parseMetaHeaders(platform, normalizedHeaders)
        break
      }

      case 'tiktok': {
        this.parseTikTokHeaders(platform, normalizedHeaders)
        break
      }
    }
  }

  /**
   * Check if a request is safe to send (remaining > safety threshold).
   * Returns whether the request is allowed and how long to wait if not.
   */
  checkQuota(platform: PlatformName): QuotaCheck {
    const state = this.state.get(platform)
    if (!state) {
      return {allowed: true, waitMs: 0}
    }

    const threshold = this.safetyThresholds[platform] ?? this.defaultSafetyThreshold

    if (state.remaining <= threshold) {
      const resetTime = new Date(state.resetsAt).getTime()
      const now = Date.now()
      const waitMs = Math.max(0, resetTime - now)
      return {allowed: false, waitMs}
    }

    return {allowed: true, waitMs: 0}
  }

  /**
   * Wait if the platform is at or below the safety threshold.
   * Returns immediately if quota is available.
   */
  async throttle(platform: PlatformName): Promise<void> {
    const check = this.checkQuota(platform)
    if (!check.allowed && check.waitMs > 0) {
      await new Promise((r) => setTimeout(r, check.waitMs))
    }
  }

  /**
   * Get current rate limit status for a platform.
   */
  getStatus(platform: PlatformName): RateLimitStatus | undefined {
    const state = this.state.get(platform)
    if (!state) {
      return undefined
    }

    return {
      platform,
      remaining: state.remaining,
      limit: state.limit,
      resetsAt: state.resetsAt,
      windowType: state.windowType,
    }
  }

  /**
   * Get status for all tracked platforms.
   */
  getAllStatus(): RateLimitStatus[] {
    const statuses: RateLimitStatus[] = []
    for (const [platform, state] of this.state) {
      statuses.push({
        platform,
        remaining: state.remaining,
        limit: state.limit,
        resetsAt: state.resetsAt,
        windowType: state.windowType,
      })
    }

    return statuses
  }

  // --- Private header parsers ---

  private parseRedditHeaders(platform: PlatformName, headers: Record<string, string>): void {
    const remaining = headers['x-ratelimit-remaining']
    const used = headers['x-ratelimit-used']
    const reset = headers['x-ratelimit-reset']

    if (remaining === undefined && used === undefined) return

    const remainingNum = remaining ? Number.parseFloat(remaining) : undefined
    const usedNum = used ? Number.parseInt(used, 10) : undefined

    // Reddit resets are in seconds from now
    const resetSeconds = reset ? Number.parseFloat(reset) : 600
    const resetsAt = new Date(Date.now() + resetSeconds * 1000).toISOString()

    // Reddit gives us remaining and used; limit = remaining + used
    const limit = (remainingNum ?? 0) + (usedNum ?? 0)

    this.state.set(platform, {
      remaining: remainingNum ?? 0,
      limit: limit || 60, // Fallback to Reddit's default 60/min
      resetsAt,
      windowType: 'minute',
    })
  }

  private parseMetaHeaders(platform: PlatformName, headers: Record<string, string>): void {
    const appUsage = headers['x-app-usage']
    if (!appUsage) return

    try {
      const usage = JSON.parse(appUsage) as {
        call_count?: number
        total_cputime?: number
        total_time?: number
      }

      // Meta provides percentages of limit used
      const callCountPercent = usage.call_count ?? 0
      const totalTimePercent = usage.total_time ?? 0
      const maxPercent = Math.max(callCountPercent, totalTimePercent)

      // Estimate remaining based on percentage (assuming 200 requests/hour for Meta)
      const limit = 200
      const remaining = Math.max(0, Math.round(limit * (1 - maxPercent / 100)))

      // Meta rate limits reset hourly
      const resetsAt = new Date(Date.now() + 3600 * 1000).toISOString()

      this.state.set(platform, {
        remaining,
        limit,
        resetsAt,
        windowType: 'hour',
      })
    } catch {
      // Invalid JSON — ignore
    }
  }

  private parseTikTokHeaders(platform: PlatformName, headers: Record<string, string>): void {
    const remaining = headers['x-ratelimit-remaining']
    const limit = headers['x-ratelimit-limit']
    const reset = headers['x-ratelimit-reset']

    if (remaining === undefined && limit === undefined) return

    const remainingNum = remaining ? Number.parseInt(remaining, 10) : 0
    const limitNum = limit ? Number.parseInt(limit, 10) : 6

    // TikTok uses epoch seconds or seconds from now
    let resetsAt: string
    if (reset) {
      const resetNum = Number.parseInt(reset, 10)
      // If the value is large, it's an epoch timestamp; otherwise it's seconds from now
      resetsAt = resetNum > 1_000_000_000
        ? new Date(resetNum * 1000).toISOString()
        : new Date(Date.now() + resetNum * 1000).toISOString()
    } else {
      resetsAt = new Date(Date.now() + 60 * 1000).toISOString()
    }

    this.state.set(platform, {
      remaining: remainingNum,
      limit: limitNum,
      resetsAt,
      windowType: 'minute',
    })
  }
}
