import type {PlatformMetrics, PlatformName} from '../platforms/types.js'

import type {ViralDetectionResult, ViralThresholdConfig} from './viral-types.js'
import {DEFAULT_VIRAL_THRESHOLDS} from './viral-types.js'

/**
 * Detects viral content by comparing post engagement metrics against
 * configurable per-platform thresholds. A post is considered viral if
 * ANY single metric exceeds its corresponding threshold value (OR logic).
 *
 * Viral detection runs once after the distribution stage completes or
 * when invoked via `mat status`. It does not continuously poll platform APIs.
 */
export class ViralDetector {
  private readonly thresholds: Record<PlatformName, ViralThresholdConfig>

  constructor(
    userThresholds?: Partial<Record<PlatformName, Partial<ViralThresholdConfig>>>,
  ) {
    // Merge user overrides with defaults (user values take precedence)
    this.thresholds = {} as Record<PlatformName, ViralThresholdConfig>
    for (const platform of Object.keys(DEFAULT_VIRAL_THRESHOLDS) as PlatformName[]) {
      const defaults = DEFAULT_VIRAL_THRESHOLDS[platform]
      const overrides = userThresholds?.[platform] ?? {}
      this.thresholds[platform] = {...defaults, ...overrides}
    }
  }

  /**
   * Evaluate an array of platform metrics and return results for posts
   * that exceed viral thresholds. Posts below all thresholds are omitted.
   */
  detectViral(metrics: PlatformMetrics[]): ViralDetectionResult[] {
    const results: ViralDetectionResult[] = []

    for (const m of metrics) {
      const threshold = this.thresholds[m.platform]
      if (!threshold) continue

      const exceeded = this.checkThresholds(m, threshold)
      if (exceeded.length > 0) {
        results.push({
          postId: m.postId,
          platform: m.platform,
          metrics: m,
          exceededThresholds: exceeded,
          detectedAt: new Date().toISOString(),
        })
      }
    }

    return results
  }

  /**
   * Get the thresholds currently in use for a given platform.
   */
  getThresholds(platform: PlatformName): ViralThresholdConfig | undefined {
    return this.thresholds[platform]
  }

  /**
   * Compare individual metrics fields against their corresponding threshold.
   * Returns an array of human-readable strings describing each exceeded threshold.
   * Uses OR logic: exceeding ANY single threshold qualifies as viral.
   */
  private checkThresholds(
    metrics: PlatformMetrics,
    thresholds: ViralThresholdConfig,
  ): string[] {
    const exceeded: string[] = []

    if (thresholds.engagementRate != null && (metrics.engagementRate ?? 0) > thresholds.engagementRate) {
      exceeded.push(`engagementRate: ${metrics.engagementRate} > ${thresholds.engagementRate}`)
    }

    if (thresholds.likes != null && (metrics.likes ?? 0) > thresholds.likes) {
      exceeded.push(`likes: ${metrics.likes} > ${thresholds.likes}`)
    }

    if (thresholds.views != null && (metrics.views ?? 0) > thresholds.views) {
      exceeded.push(`views: ${metrics.views} > ${thresholds.views}`)
    }

    if (thresholds.comments != null && (metrics.comments ?? 0) > thresholds.comments) {
      exceeded.push(`comments: ${metrics.comments} > ${thresholds.comments}`)
    }

    if (thresholds.shares != null && (metrics.shares ?? 0) > thresholds.shares) {
      exceeded.push(`shares: ${metrics.shares} > ${thresholds.shares}`)
    }

    return exceeded
  }
}
