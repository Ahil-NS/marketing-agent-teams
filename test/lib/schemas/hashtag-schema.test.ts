import {describe, it, expect} from 'vitest'

import {
  hashtagRecommendationSchema,
  platformHashtagSetSchema,
  hashtagStrategyOutputSchema,
} from '../../../src/lib/schemas/hashtag-schema.js'

// --- Valid test data ---

const validRecommendation = {
  tag: 'wellness',
  reachEstimate: 'high' as const,
  relevanceScore: 85,
  competitionLevel: 'medium' as const,
  category: 'evergreen' as const,
}

const validPlatformSet = {
  platform: 'instagram' as const,
  hashtags: [validRecommendation],
  totalReach: 'high' as const,
  mixBreakdown: {trending: 0, niche: 0, branded: 0, evergreen: 1, community: 0},
}

const validStrategyOutput = {
  contentItemId: 'content-123',
  platformSets: [validPlatformSet],
  strategy: 'Focus on evergreen wellness hashtags for consistent reach',
  avoidedTags: ['#fyp', '#viral'],
}

describe('hashtagRecommendationSchema', () => {
  it('accepts valid recommendation', () => {
    const result = hashtagRecommendationSchema.safeParse(validRecommendation)
    expect(result.success).toBe(true)
  })

  it('rejects empty tag (fails .min(1))', () => {
    const result = hashtagRecommendationSchema.safeParse({...validRecommendation, tag: ''})
    expect(result.success).toBe(false)
  })

  it('rejects relevanceScore outside 0-100 range (above)', () => {
    const result = hashtagRecommendationSchema.safeParse({...validRecommendation, relevanceScore: 101})
    expect(result.success).toBe(false)
  })

  it('rejects relevanceScore outside 0-100 range (below)', () => {
    const result = hashtagRecommendationSchema.safeParse({...validRecommendation, relevanceScore: -1})
    expect(result.success).toBe(false)
  })

  it('rejects invalid reachEstimate', () => {
    const result = hashtagRecommendationSchema.safeParse({...validRecommendation, reachEstimate: 'massive'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid competitionLevel', () => {
    const result = hashtagRecommendationSchema.safeParse({...validRecommendation, competitionLevel: 'extreme'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = hashtagRecommendationSchema.safeParse({...validRecommendation, category: 'viral'})
    expect(result.success).toBe(false)
  })
})

describe('platformHashtagSetSchema', () => {
  it('accepts valid set with multiple hashtags', () => {
    const set = {
      ...validPlatformSet,
      hashtags: [
        validRecommendation,
        {...validRecommendation, tag: 'meditation', category: 'niche' as const, relevanceScore: 72},
      ],
      mixBreakdown: {trending: 0, niche: 1, branded: 0, evergreen: 1, community: 0},
    }
    const result = platformHashtagSetSchema.safeParse(set)
    expect(result.success).toBe(true)
  })

  it('rejects invalid platform', () => {
    const result = platformHashtagSetSchema.safeParse({...validPlatformSet, platform: 'youtube'})
    expect(result.success).toBe(false)
  })

  it('accepts empty hashtags array', () => {
    const set = {
      ...validPlatformSet,
      hashtags: [],
      mixBreakdown: {trending: 0, niche: 0, branded: 0, evergreen: 0, community: 0},
    }
    const result = platformHashtagSetSchema.safeParse(set)
    expect(result.success).toBe(true)
  })
})

describe('hashtagStrategyOutputSchema', () => {
  it('accepts output with multiple platform sets', () => {
    const output = {
      ...validStrategyOutput,
      platformSets: [
        validPlatformSet,
        {...validPlatformSet, platform: 'tiktok' as const},
      ],
    }
    const result = hashtagStrategyOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })

  it('accepts empty avoidedTags array', () => {
    const output = {...validStrategyOutput, avoidedTags: []}
    const result = hashtagStrategyOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })

  it('rejects empty contentItemId', () => {
    const result = hashtagStrategyOutputSchema.safeParse({...validStrategyOutput, contentItemId: ''})
    expect(result.success).toBe(false)
  })

  it('rejects empty strategy', () => {
    const result = hashtagStrategyOutputSchema.safeParse({...validStrategyOutput, strategy: ''})
    expect(result.success).toBe(false)
  })
})
