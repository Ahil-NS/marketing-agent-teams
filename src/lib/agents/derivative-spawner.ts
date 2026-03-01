import {z} from 'zod'

import type {ContentItem, EngagementMetrics, DerivativeContentItem} from '../schemas/creation-schema.js'
import type {ViralThreshold} from '../schemas/config-schema.js'

import {AgentValidationError} from './errors.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ViralContentDetection {
  originalItemId: string
  platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram'
  engagementMetrics: EngagementMetrics
  thresholdExceeded: boolean
  detectedAt: string
  sourceContent: ContentItem
}

export interface DerivativeSpawnResult {
  derivatives: DerivativeContentItem[]
  sourceItemId: string
  spawnedAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate the percentile value from a sorted array of numbers.
 * Uses linear interpolation between adjacent values.
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  const index = p * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const fraction = index - lower

  if (lower === upper) return sortedValues[lower]
  return sortedValues[lower] + fraction * (sortedValues[upper] - sortedValues[lower])
}

/**
 * Get the effective threshold percentile for a given platform.
 * Uses per-platform override if available, otherwise the default.
 */
function getEffectiveThreshold(
  platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram',
  threshold: ViralThreshold,
): number {
  const platformOverride = threshold.perPlatform[platform]
  return platformOverride ?? threshold.default
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Detect published content that exceeds engagement thresholds.
 *
 * Compares current engagement metrics against historical engagement data
 * to identify content performing above the configured percentile threshold.
 *
 * @param publishedContent - Content items that have been published
 * @param currentEngagement - Current engagement metrics for published content
 * @param historicalEngagement - Historical engagement data for percentile calculation
 * @param threshold - Viral threshold configuration
 * @returns Array of viral content detections (empty if none exceed threshold or disabled)
 */
export function detectViralContent(
  publishedContent: ContentItem[],
  currentEngagement: EngagementMetrics[],
  historicalEngagement: EngagementMetrics[],
  threshold: ViralThreshold,
): ViralContentDetection[] {
  if (!threshold.enabled) return []
  if (historicalEngagement.length === 0) return []

  const now = new Date().toISOString()
  const results: ViralContentDetection[] = []

  // Build lookup: itemId -> current engagement
  const engagementByItem = new Map<string, EngagementMetrics>()
  for (const metric of currentEngagement) {
    engagementByItem.set(metric.itemId, metric)
  }

  // Group historical engagement by platform for per-platform percentile calculation
  const historicalByPlatform = new Map<string, number[]>()
  for (const metric of historicalEngagement) {
    const existing = historicalByPlatform.get(metric.platform) ?? []
    existing.push(metric.engagementRate)
    historicalByPlatform.set(metric.platform, existing)
  }

  // Sort each platform's historical rates for percentile calculation
  for (const [platform, rates] of historicalByPlatform) {
    historicalByPlatform.set(platform, rates.sort((a, b) => a - b))
  }

  for (const content of publishedContent) {
    const engagement = engagementByItem.get(content.itemId)
    if (!engagement) continue

    const platformRates = historicalByPlatform.get(content.platform)
    if (!platformRates || platformRates.length === 0) continue

    const effectiveThreshold = getEffectiveThreshold(content.platform, threshold)
    const thresholdValue = percentile(platformRates, effectiveThreshold)

    if (engagement.engagementRate > thresholdValue) {
      results.push({
        originalItemId: content.itemId,
        platform: content.platform,
        engagementMetrics: engagement,
        thresholdExceeded: true,
        detectedAt: now,
        sourceContent: content,
      })
    }
  }

  return results
}

/**
 * Spawn derivative content from a viral content item.
 *
 * Creates derivative content items for each target platform, using different
 * variation strategies: cross-platform adaptations for other platforms,
 * hook-variations for the source platform.
 *
 * @param viralItem - The detected viral content item
 * @param targetPlatforms - Platforms to create derivatives for
 * @returns Derivative spawn result with all generated derivatives
 */
export async function spawnDerivatives(
  viralItem: ViralContentDetection,
  targetPlatforms: string[],
): Promise<DerivativeSpawnResult> {
  // Validate platforms at system boundary (Zod validation rule)
  const platformEnum = z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])
  const validatedPlatforms: Array<'reddit' | 'tiktok' | 'facebook' | 'instagram'> = []

  for (const platform of targetPlatforms) {
    const result = platformEnum.safeParse(platform)
    if (!result.success) {
      throw new AgentValidationError(
        'derivative-spawner',
        `Invalid target platform '${platform}'. Must be one of: reddit, tiktok, facebook, instagram`,
      )
    }

    validatedPlatforms.push(result.data)
  }

  const now = new Date().toISOString()
  const derivatives: DerivativeContentItem[] = []

  for (let i = 0; i < validatedPlatforms.length; i++) {
    const typedPlatform = validatedPlatforms[i]
    const isSourcePlatform = typedPlatform === viralItem.platform

    const derivativeType = isSourcePlatform ? 'hook-variation' as const : 'cross-platform' as const
    const variationStrategy = isSourcePlatform
      ? 'Different hook angle on the same theme for same platform'
      : `Cross-platform adaptation from ${viralItem.platform} to ${typedPlatform}`

    // Derivatives must vary meaningfully from original (AC5).
    // Content here is a seed — full agent-based creation runs when the
    // derivative pipeline executes its creation stage via the orchestrator.
    const {title, body} = generateDerivativeContent(
      viralItem.sourceContent,
      typedPlatform,
      derivativeType,
    )

    const derivative: DerivativeContentItem = {
      itemId: `deriv-${viralItem.originalItemId}-${typedPlatform}-${i}`,
      platform: typedPlatform,
      contentType: getDefaultContentType(typedPlatform),
      title,
      body,
      metadata: {
        derivativeOf: viralItem.originalItemId,
        sourcePlatform: viralItem.platform,
        tags: ['trending-derivative'],
        sourceEngagement: viralItem.engagementMetrics,
      },
      status: 'draft',
      generatedBy: `${typedPlatform}-creator`,
      agentName: `${typedPlatform}-creator`,
      campaignId: viralItem.sourceContent.campaignId,
      createdAt: now,
      sourceItemId: viralItem.originalItemId,
      derivativeType,
      variationStrategy,
    }

    derivatives.push(derivative)
  }

  return {
    derivatives,
    sourceItemId: viralItem.originalItemId,
    spawnedAt: now,
  }
}

/**
 * Generate differentiated content for a derivative item.
 * Each derivative gets platform-specific, angle-specific content
 * rather than copying the original verbatim (AC5).
 *
 * These are seed items — the creation agents in the derivative pipeline's
 * creation stage will produce the final, fully-formed content.
 */
function generateDerivativeContent(
  sourceContent: ContentItem,
  platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram',
  derivativeType: 'hook-variation' | 'cross-platform',
): {title: string; body: string} {
  if (derivativeType === 'hook-variation') {
    return {
      title: `[New Angle] ${sourceContent.title}`,
      body: `Alternative hook for ${platform}: reimagined take on the theme "${sourceContent.title}".`,
    }
  }

  // Cross-platform adaptations get platform-specific formatting
  const formatMap: Record<string, string> = {
    reddit: 'discussion thread',
    tiktok: 'short-form video script',
    facebook: 'social post',
    instagram: 'visual story',
  }

  return {
    title: `[${platform}] ${sourceContent.title}`,
    body: `Cross-platform adaptation for ${platform} (${formatMap[platform]}). Original from ${sourceContent.platform}: "${sourceContent.title}".`,
  }
}

/**
 * Get the default content type for a given platform.
 */
function getDefaultContentType(platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram'): string {
  switch (platform) {
    case 'reddit': return 'post'
    case 'tiktok': return 'video-script'
    case 'facebook': return 'text'
    case 'instagram': return 'static'
  }
}
