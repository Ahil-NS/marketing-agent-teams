import {describe, it, expect} from 'vitest'

import {
  basePlatformSeoConfigSchema,
  tiktokSeoConfigSchema,
  redditSeoConfigSchema,
  facebookSeoConfigSchema,
  instagramSeoConfigSchema,
  seoOptimizationOutputSchema,
  seoContentItemSchema,
  seoRuleApplicationSchema,
  seoOptimizationResultSchema,
  tiktokSeoLayersSchema,
} from '../../../src/lib/schemas/seo-schema.js'

// --- Valid platform configs ---

const validTiktokConfig = {
  platform: 'tiktok' as const,
  keywordDensity: {min: 0.01, max: 0.03, target: 0.02},
  hashtagRange: {min: 3, max: 5},
  altTextRequired: false,
  structuredData: false,
  rankingSignals: ['watch-time', 'shares', 'comments'],
  charLimits: {
    body: {max: 4000, optimal: 150},
    caption: {max: 4000, optimal: 150},
  },
  indexableLayers: {
    captionText: {maxChars: 4000, keywordPlacement: 'first line'},
    ocrTextOverlay: {enabled: true, keywordInclusion: true},
    audioKeywords: {firstNSeconds: 5, keywordDensity: 'high'},
    hashtags: {count: {min: 3, max: 5}, avoidGeneric: ['#fyp']},
  },
}

const validRedditConfig = {
  platform: 'reddit' as const,
  keywordDensity: {min: 0.005, max: 0.02, target: 0.01},
  hashtagRange: {min: 0, max: 0},
  altTextRequired: false,
  structuredData: false,
  rankingSignals: ['upvotes', 'comment-count'],
  charLimits: {
    title: {max: 300, optimal: 60},
    body: {max: 40000, optimal: 400},
  },
  titleKeywordFrontLoading: true,
  optimalPostWordCount: {min: 300, max: 500},
  googleSearchVisibility: true,
}

const validFacebookConfig = {
  platform: 'facebook' as const,
  keywordDensity: {min: 0.005, max: 0.02, target: 0.01},
  hashtagRange: {min: 1, max: 2},
  altTextRequired: false,
  structuredData: false,
  rankingSignals: ['comments', 'shares', 'reactions'],
  charLimits: {
    body: {max: 63206, optimal: 60},
  },
  commentWeightOptimization: true,
  videoPreferenceSignal: true,
}

const validInstagramConfig = {
  platform: 'instagram' as const,
  keywordDensity: {min: 0.01, max: 0.03, target: 0.02},
  hashtagRange: {min: 3, max: 5},
  altTextRequired: true,
  altTextCharLimit: {max: 125, optimal: 110},
  structuredData: false,
  rankingSignals: ['saves', 'shares', 'comments'],
  charLimits: {
    body: {max: 2200, optimal: 150, visiblePreview: 125},
  },
  savesSharesWeight: 'highest',
  captionKeywordZone: {visibleChars: 125, keywordPlacement: 'first 125 chars'},
}

// --- Valid SEO output data ---

const validContentItem = {
  contentId: 'content-1',
  platform: 'tiktok' as const,
  body: 'Check out our new wellness app!',
  hashtags: ['#wellness', '#meditation'],
}

const validRuleApplication = {
  ruleType: 'keyword-density' as const,
  before: 'Check out our app',
  after: 'Check out our wellness meditation app',
  rationale: 'Added target keywords for SEO',
}

const validSeoResult = {
  contentId: 'content-1',
  platform: 'tiktok' as const,
  originalContent: validContentItem,
  optimizedContent: {...validContentItem, body: 'Updated body with keywords'},
  appliedRules: [validRuleApplication],
  seoScore: 85,
  recommendations: ['Add alt text to images'],
}

const validSeoOutput = {
  items: [validSeoResult],
  summary: {
    totalItems: 1,
    averageSeoScore: 85,
    platformBreakdown: {
      tiktok: {count: 1, averageScore: 85},
    },
  },
}

describe('Platform SEO Config Schemas', () => {
  describe('TikTok config', () => {
    it('validates correct TikTok config', () => {
      const result = tiktokSeoConfigSchema.safeParse(validTiktokConfig)
      expect(result.success).toBe(true)
    })

    it('includes all 4 indexable layers', () => {
      const result = tiktokSeoConfigSchema.parse(validTiktokConfig)
      expect(result.indexableLayers).toBeDefined()
      expect(result.indexableLayers.captionText).toBeDefined()
      expect(result.indexableLayers.ocrTextOverlay).toBeDefined()
      expect(result.indexableLayers.audioKeywords).toBeDefined()
      expect(result.indexableLayers.hashtags).toBeDefined()
    })

    it('rejects TikTok config missing indexable layers', () => {
      const {indexableLayers: _, ...withoutLayers} = validTiktokConfig
      const result = tiktokSeoConfigSchema.safeParse(withoutLayers)
      expect(result.success).toBe(false)
    })
  })

  describe('Reddit config', () => {
    it('validates correct Reddit config with zero hashtags', () => {
      const result = redditSeoConfigSchema.safeParse(validRedditConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hashtagRange.min).toBe(0)
        expect(result.data.hashtagRange.max).toBe(0)
      }
    })

    it('requires titleKeywordFrontLoading field', () => {
      const {titleKeywordFrontLoading: _, ...withoutField} = validRedditConfig
      const result = redditSeoConfigSchema.safeParse(withoutField)
      expect(result.success).toBe(false)
    })
  })

  describe('Facebook config', () => {
    it('validates correct Facebook config', () => {
      const result = facebookSeoConfigSchema.safeParse(validFacebookConfig)
      expect(result.success).toBe(true)
    })

    it('requires commentWeightOptimization field', () => {
      const {commentWeightOptimization: _, ...withoutField} = validFacebookConfig
      const result = facebookSeoConfigSchema.safeParse(withoutField)
      expect(result.success).toBe(false)
    })
  })

  describe('Instagram config', () => {
    it('validates correct Instagram config', () => {
      const result = instagramSeoConfigSchema.safeParse(validInstagramConfig)
      expect(result.success).toBe(true)
    })

    it('requires captionKeywordZone field', () => {
      const {captionKeywordZone: _, ...withoutField} = validInstagramConfig
      const result = instagramSeoConfigSchema.safeParse(withoutField)
      expect(result.success).toBe(false)
    })
  })

  describe('base config validation', () => {
    it('rejects config with out-of-range hashtag counts', () => {
      const badConfig = {
        ...validTiktokConfig,
        hashtagRange: {min: -1, max: 5},
      }
      // Remove tiktok-specific fields to test base schema
      const result = basePlatformSeoConfigSchema.safeParse(badConfig)
      expect(result.success).toBe(false)
    })

    it('rejects config with keyword density above 1', () => {
      const badConfig = {
        ...validTiktokConfig,
        keywordDensity: {min: 0, max: 1.5, target: 0.5},
      }
      const result = basePlatformSeoConfigSchema.safeParse(badConfig)
      expect(result.success).toBe(false)
    })

    it('rejects config with unsupported platform', () => {
      const badConfig = {
        ...validTiktokConfig,
        platform: 'youtube',
      }
      const result = basePlatformSeoConfigSchema.safeParse(badConfig)
      expect(result.success).toBe(false)
    })
  })
})

describe('SEO Output Schemas', () => {
  describe('SeoContentItemSchema', () => {
    it('validates correct content item', () => {
      const result = seoContentItemSchema.safeParse(validContentItem)
      expect(result.success).toBe(true)
    })

    it('rejects empty contentId', () => {
      const result = seoContentItemSchema.safeParse({...validContentItem, contentId: ''})
      expect(result.success).toBe(false)
    })

    it('allows optional fields', () => {
      const minimal = {contentId: 'c1', platform: 'reddit', body: 'Hello world'}
      const result = seoContentItemSchema.safeParse(minimal)
      expect(result.success).toBe(true)
    })
  })

  describe('SeoRuleApplicationSchema', () => {
    it('validates correct rule application', () => {
      const result = seoRuleApplicationSchema.safeParse(validRuleApplication)
      expect(result.success).toBe(true)
    })

    it('rejects invalid ruleType', () => {
      const result = seoRuleApplicationSchema.safeParse({
        ...validRuleApplication,
        ruleType: 'invalid-type',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('SeoOptimizationOutputSchema', () => {
    it('validates correct multi-platform output', () => {
      const result = seoOptimizationOutputSchema.safeParse(validSeoOutput)
      expect(result.success).toBe(true)
    })

    it('rejects empty items array', () => {
      const result = seoOptimizationOutputSchema.safeParse({
        ...validSeoOutput,
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing summary', () => {
      const {summary: _, ...withoutSummary} = validSeoOutput
      const result = seoOptimizationOutputSchema.safeParse(withoutSummary)
      expect(result.success).toBe(false)
    })

    it('rejects seoScore out of range', () => {
      const badOutput = {
        ...validSeoOutput,
        items: [{...validSeoResult, seoScore: 150}],
      }
      const result = seoOptimizationOutputSchema.safeParse(badOutput)
      expect(result.success).toBe(false)
    })

    it('rejects missing required fields in result', () => {
      const {appliedRules: _, ...incomplete} = validSeoResult
      const result = seoOptimizationResultSchema.safeParse(incomplete)
      expect(result.success).toBe(false)
    })

    it('validates multi-platform breakdown', () => {
      const multiPlatform = {
        items: [
          validSeoResult,
          {...validSeoResult, contentId: 'content-2', platform: 'reddit' as const, originalContent: {...validContentItem, contentId: 'content-2', platform: 'reddit' as const}, optimizedContent: {...validContentItem, contentId: 'content-2', platform: 'reddit' as const}},
        ],
        summary: {
          totalItems: 2,
          averageSeoScore: 80,
          platformBreakdown: {
            tiktok: {count: 1, averageScore: 85},
            reddit: {count: 1, averageScore: 75},
          },
        },
      }
      const result = seoOptimizationOutputSchema.safeParse(multiPlatform)
      expect(result.success).toBe(true)
    })
  })

  describe('TikTok indexable layers schema', () => {
    it('validates all 4 layers', () => {
      const layers = validTiktokConfig.indexableLayers
      const result = tiktokSeoLayersSchema.safeParse(layers)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Object.keys(result.data)).toEqual(
          expect.arrayContaining(['captionText', 'ocrTextOverlay', 'audioKeywords', 'hashtags']),
        )
      }
    })

    it('rejects missing layer', () => {
      const {captionText: _, ...missingLayer} = validTiktokConfig.indexableLayers
      const result = tiktokSeoLayersSchema.safeParse(missingLayer)
      expect(result.success).toBe(false)
    })
  })
})
