import {z} from 'zod'

// --- Platform SEO Configuration Schemas (Task 1) ---

export const hashtagRangeSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
})

export const charLimitSchema = z.object({
  max: z.number().int().positive(),
  optimal: z.number().int().positive().optional(),
  visiblePreview: z.number().int().positive().optional(),
})

export const basePlatformSeoConfigSchema = z.object({
  platform: z.enum(['tiktok', 'reddit', 'facebook', 'instagram']),
  keywordDensity: z.object({
    min: z.number().min(0).max(1),
    max: z.number().min(0).max(1),
    target: z.number().min(0).max(1),
  }),
  hashtagRange: hashtagRangeSchema,
  altTextRequired: z.boolean(),
  altTextCharLimit: charLimitSchema.optional(),
  structuredData: z.boolean(),
  rankingSignals: z.array(z.string()),
  charLimits: z.object({
    title: charLimitSchema.optional(),
    body: charLimitSchema,
    caption: charLimitSchema.optional(),
  }),
})

export type PlatformSeoConfig = z.infer<typeof basePlatformSeoConfigSchema>

// TikTok-specific: 4 indexable layers
export const tiktokSeoLayersSchema = z.object({
  captionText: z.object({
    maxChars: z.number().int(),
    keywordPlacement: z.string(),
  }),
  ocrTextOverlay: z.object({
    enabled: z.boolean(),
    keywordInclusion: z.boolean(),
  }),
  audioKeywords: z.object({
    firstNSeconds: z.number().int(),
    keywordDensity: z.string(),
  }),
  hashtags: z.object({
    count: hashtagRangeSchema,
    avoidGeneric: z.array(z.string()),
  }),
})

export type TikTokSeoLayers = z.infer<typeof tiktokSeoLayersSchema>

export const tiktokSeoConfigSchema = basePlatformSeoConfigSchema.extend({
  platform: z.literal('tiktok'),
  indexableLayers: tiktokSeoLayersSchema,
})

export type TikTokSeoConfig = z.infer<typeof tiktokSeoConfigSchema>

export const redditSeoConfigSchema = basePlatformSeoConfigSchema.extend({
  platform: z.literal('reddit'),
  titleKeywordFrontLoading: z.boolean(),
  optimalPostWordCount: z.object({
    min: z.number().int(),
    max: z.number().int(),
  }),
  googleSearchVisibility: z.boolean(),
})

export type RedditSeoConfig = z.infer<typeof redditSeoConfigSchema>

export const facebookSeoConfigSchema = basePlatformSeoConfigSchema.extend({
  platform: z.literal('facebook'),
  commentWeightOptimization: z.boolean(),
  videoPreferenceSignal: z.boolean(),
})

export type FacebookSeoConfig = z.infer<typeof facebookSeoConfigSchema>

export const instagramSeoConfigSchema = basePlatformSeoConfigSchema.extend({
  platform: z.literal('instagram'),
  savesSharesWeight: z.string(),
  captionKeywordZone: z.object({
    visibleChars: z.number().int(),
    keywordPlacement: z.string(),
  }),
})

export type InstagramSeoConfig = z.infer<typeof instagramSeoConfigSchema>

// --- SEO Agent Output Schemas (Task 2) ---

export const seoRuleApplicationSchema = z.object({
  ruleType: z.enum([
    'keyword-density',
    'hashtag-count',
    'alt-text',
    'structured-data',
    'ranking-signal',
    'char-limit',
    'indexable-layer',
  ]),
  before: z.string(),
  after: z.string(),
  rationale: z.string(),
})

export type SeoRuleApplication = z.infer<typeof seoRuleApplicationSchema>

export const seoContentItemSchema = z.object({
  contentId: z.string().min(1),
  platform: z.enum(['tiktok', 'reddit', 'facebook', 'instagram']),
  title: z.string().optional(),
  body: z.string(),
  hashtags: z.array(z.string()).optional(),
  altText: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type SeoContentItem = z.infer<typeof seoContentItemSchema>

export const seoOptimizationResultSchema = z.object({
  contentId: z.string().min(1),
  platform: z.enum(['tiktok', 'reddit', 'facebook', 'instagram']),
  originalContent: seoContentItemSchema,
  optimizedContent: seoContentItemSchema,
  appliedRules: z.array(seoRuleApplicationSchema),
  seoScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
})

export type SeoOptimizationResult = z.infer<typeof seoOptimizationResultSchema>

export const platformBreakdownEntrySchema = z.object({
  count: z.number().int(),
  averageScore: z.number().min(0).max(100),
})

export const seoOptimizationOutputSchema = z.object({
  items: z.array(seoOptimizationResultSchema).min(1),
  summary: z.object({
    totalItems: z.number().int().min(1),
    averageSeoScore: z.number().min(0).max(100),
    platformBreakdown: z.record(z.string(), platformBreakdownEntrySchema),
  }),
})

export type SeoOptimizationOutput = z.infer<typeof seoOptimizationOutputSchema>
