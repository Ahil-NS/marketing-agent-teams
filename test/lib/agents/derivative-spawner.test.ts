import {describe, it, expect, vi, beforeEach} from 'vitest'

import type {ViralThreshold} from '../../../src/lib/schemas/config-schema.js'

// ── Test Data ────────────────────────────────────────────────────────────────

const makeEngagementMetrics = (overrides: Partial<{
  itemId: string
  platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram'
  likes: number
  shares: number
  comments: number
  views: number
  engagementRate: number
}> = {}) => ({
  itemId: overrides.itemId ?? 'item-001',
  platform: overrides.platform ?? 'reddit' as const,
  likes: overrides.likes ?? 100,
  shares: overrides.shares ?? 20,
  comments: overrides.comments ?? 50,
  views: overrides.views ?? 5000,
  engagementRate: overrides.engagementRate ?? 0.034,
})

const makePublishedContentItem = (overrides: Partial<{
  itemId: string
  platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram'
  title: string
  body: string
  campaignId: string
}> = {}) => ({
  itemId: overrides.itemId ?? 'item-001',
  platform: overrides.platform ?? 'reddit' as const,
  contentType: 'post',
  title: overrides.title ?? 'Viral Post Title',
  body: overrides.body ?? 'Content body goes here',
  metadata: {},
  status: 'published' as const,
  generatedBy: 'reddit-creator',
  agentName: 'reddit-creator',
  campaignId: overrides.campaignId ?? 'campaign-001',
  createdAt: '2026-03-01T00:00:00Z',
})

const makeHistoricalEngagement = (platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram', rates: number[]) =>
  rates.map((rate, i) => makeEngagementMetrics({
    itemId: `hist-${platform}-${i}`,
    platform,
    engagementRate: rate,
  }))

const defaultThreshold: ViralThreshold = {
  default: 0.75,
  perPlatform: {},
  enabled: true,
}

describe('detectViralContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('identifies content above threshold', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    // Historical data: rates [0.01, 0.02, 0.03, 0.04] → 75th percentile ≈ 0.0325
    const historicalEngagement = makeHistoricalEngagement('reddit', [0.01, 0.02, 0.03, 0.04])
    const publishedContent = [makePublishedContentItem({itemId: 'item-viral'})]
    // Current engagement rate 0.05 > 0.0325 (75th percentile)
    const currentEngagement = [makeEngagementMetrics({itemId: 'item-viral', engagementRate: 0.05})]

    const result = detectViralContent(publishedContent, currentEngagement, historicalEngagement, defaultThreshold)

    expect(result).toHaveLength(1)
    expect(result[0].originalItemId).toBe('item-viral')
    expect(result[0].thresholdExceeded).toBe(true)
  })

  it('respects per-platform thresholds', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    const historicalEngagement = makeHistoricalEngagement('tiktok', [0.01, 0.02, 0.03, 0.04])
    const publishedContent = [makePublishedContentItem({itemId: 'item-tiktok', platform: 'tiktok'})]
    // With 90th percentile threshold, rate 0.05 might not exceed it
    const currentEngagement = [makeEngagementMetrics({itemId: 'item-tiktok', platform: 'tiktok', engagementRate: 0.035})]

    const thresholdWith90thForTiktok: ViralThreshold = {
      default: 0.75,
      perPlatform: {tiktok: 0.9},
      enabled: true,
    }

    const result = detectViralContent(publishedContent, currentEngagement, historicalEngagement, thresholdWith90thForTiktok)
    // 90th percentile of [0.01, 0.02, 0.03, 0.04] ≈ 0.037, so 0.035 should NOT exceed
    expect(result).toHaveLength(0)
  })

  it('returns empty when no content exceeds threshold', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    const historicalEngagement = makeHistoricalEngagement('reddit', [0.01, 0.02, 0.03, 0.04])
    const publishedContent = [makePublishedContentItem()]
    // Below 75th percentile
    const currentEngagement = [makeEngagementMetrics({engagementRate: 0.02})]

    const result = detectViralContent(publishedContent, currentEngagement, historicalEngagement, defaultThreshold)

    expect(result).toHaveLength(0)
  })

  it('returns empty when threshold is disabled', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    const historicalEngagement = makeHistoricalEngagement('reddit', [0.01, 0.02, 0.03, 0.04])
    const publishedContent = [makePublishedContentItem()]
    const currentEngagement = [makeEngagementMetrics({engagementRate: 0.99})]

    const disabledThreshold: ViralThreshold = {
      default: 0.75,
      perPlatform: {},
      enabled: false,
    }

    const result = detectViralContent(publishedContent, currentEngagement, historicalEngagement, disabledThreshold)
    expect(result).toHaveLength(0)
  })

  it('returns empty when no historical engagement data exists', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    const publishedContent = [makePublishedContentItem()]
    const currentEngagement = [makeEngagementMetrics({engagementRate: 0.05})]

    const result = detectViralContent(publishedContent, currentEngagement, [], defaultThreshold)
    expect(result).toHaveLength(0)
  })

  it('detects multiple viral items across platforms', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    const historicalReddit = makeHistoricalEngagement('reddit', [0.01, 0.02, 0.03, 0.04])
    const historicalTiktok = makeHistoricalEngagement('tiktok', [0.05, 0.06, 0.07, 0.08])
    const historicalEngagement = [...historicalReddit, ...historicalTiktok]

    const publishedContent = [
      makePublishedContentItem({itemId: 'reddit-viral', platform: 'reddit'}),
      makePublishedContentItem({itemId: 'tiktok-viral', platform: 'tiktok'}),
    ]
    const currentEngagement = [
      makeEngagementMetrics({itemId: 'reddit-viral', platform: 'reddit', engagementRate: 0.05}),
      makeEngagementMetrics({itemId: 'tiktok-viral', platform: 'tiktok', engagementRate: 0.1}),
    ]

    const result = detectViralContent(publishedContent, currentEngagement, historicalEngagement, defaultThreshold)
    expect(result).toHaveLength(2)
  })

  it('includes detectedAt timestamp in results', async () => {
    const {detectViralContent} = await import('../../../src/lib/agents/derivative-spawner.js')

    const historicalEngagement = makeHistoricalEngagement('reddit', [0.01, 0.02, 0.03, 0.04])
    const publishedContent = [makePublishedContentItem({itemId: 'item-viral'})]
    const currentEngagement = [makeEngagementMetrics({itemId: 'item-viral', engagementRate: 0.05})]

    const result = detectViralContent(publishedContent, currentEngagement, historicalEngagement, defaultThreshold)
    expect(result).toHaveLength(1)
    expect(result[0].detectedAt).toBeDefined()
    // ISO 8601 format
    expect(new Date(result[0].detectedAt).toISOString()).toBe(result[0].detectedAt)
  })
})

describe('spawnDerivatives', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('creates derivatives tagged as trending-derivative', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: makeEngagementMetrics({engagementRate: 0.05}),
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent: makePublishedContentItem(),
    }

    const result = await spawnDerivatives(viralItem, ['tiktok', 'facebook'])

    expect(result.derivatives).toHaveLength(2)
    for (const derivative of result.derivatives) {
      expect(derivative.metadata.tags).toContain('trending-derivative')
    }
  })

  it('creates derivatives that link back to source content', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: makeEngagementMetrics({engagementRate: 0.05}),
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent: makePublishedContentItem(),
    }

    const result = await spawnDerivatives(viralItem, ['tiktok'])

    expect(result.derivatives).toHaveLength(1)
    expect(result.derivatives[0].metadata.derivativeOf).toBe('item-001')
    expect(result.derivatives[0].metadata.sourcePlatform).toBe('reddit')
  })

  it('creates cross-platform derivatives for different platforms', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: makeEngagementMetrics({engagementRate: 0.05}),
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent: makePublishedContentItem(),
    }

    const result = await spawnDerivatives(viralItem, ['tiktok', 'facebook', 'instagram'])

    // Each derivative targets a different platform than the original
    const platforms = result.derivatives.map((d) => d.platform)
    expect(platforms).toContain('tiktok')
    expect(platforms).toContain('facebook')
    expect(platforms).toContain('instagram')
    expect(platforms).not.toContain('reddit') // Source platform excluded
  })

  it('creates hook variation derivative for source platform', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: makeEngagementMetrics({engagementRate: 0.05}),
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent: makePublishedContentItem(),
    }

    // Include source platform — should get a hook-variation derivative
    const result = await spawnDerivatives(viralItem, ['reddit', 'tiktok'])

    const hookVariation = result.derivatives.find((d) => d.derivativeType === 'hook-variation')
    expect(hookVariation).toBeDefined()
    expect(hookVariation!.platform).toBe('reddit')
  })

  it('derivatives vary meaningfully from original', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const sourceContent = makePublishedContentItem()
    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: makeEngagementMetrics({engagementRate: 0.05}),
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent,
    }

    const result = await spawnDerivatives(viralItem, ['reddit', 'tiktok', 'facebook'])

    // Each derivative should have a variation strategy
    for (const derivative of result.derivatives) {
      expect(derivative.variationStrategy).toBeDefined()
      expect(derivative.variationStrategy.length).toBeGreaterThan(0)
    }

    // Derivative types should vary
    const types = new Set(result.derivatives.map((d) => d.derivativeType))
    expect(types.size).toBeGreaterThanOrEqual(2)

    // No derivative body is a verbatim copy of the original (AC5)
    for (const derivative of result.derivatives) {
      expect(derivative.body).not.toBe(sourceContent.body)
    }
  })

  it('includes source engagement metrics in derivatives', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const metrics = makeEngagementMetrics({engagementRate: 0.05, likes: 500, shares: 100})
    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: metrics,
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent: makePublishedContentItem(),
    }

    const result = await spawnDerivatives(viralItem, ['tiktok'])

    expect(result.derivatives[0].metadata.sourceEngagement).toBeDefined()
    expect(result.derivatives[0].metadata.sourceEngagement.engagementRate).toBe(0.05)
  })

  it('rejects invalid platform with AgentValidationError', async () => {
    const {spawnDerivatives} = await import('../../../src/lib/agents/derivative-spawner.js')

    const viralItem = {
      originalItemId: 'item-001',
      platform: 'reddit' as const,
      engagementMetrics: makeEngagementMetrics({engagementRate: 0.05}),
      thresholdExceeded: true,
      detectedAt: new Date().toISOString(),
      sourceContent: makePublishedContentItem(),
    }

    await expect(spawnDerivatives(viralItem, ['twitter'])).rejects.toThrow('Invalid target platform')
  })
})
