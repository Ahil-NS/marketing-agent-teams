import {z} from 'zod'

/**
 * A single hashtag recommendation with reach, relevance, and competition metadata.
 */
export const hashtagRecommendationSchema = z.object({
  /** The hashtag without '#' prefix */
  tag: z.string().min(1),
  /** Estimated audience reach */
  reachEstimate: z.enum(['high', 'medium', 'low']),
  /** Relevance to content (0-100) */
  relevanceScore: z.number().min(0).max(100),
  /** How saturated the hashtag is */
  competitionLevel: z.enum(['high', 'medium', 'low']),
  /** Hashtag type */
  category: z.enum(['trending', 'niche', 'branded', 'evergreen', 'community']),
})

export type HashtagRecommendation = z.infer<typeof hashtagRecommendationSchema>

/**
 * A set of hashtag recommendations for a specific platform.
 */
export const platformHashtagSetSchema = z.object({
  /** Target platform */
  platform: z.enum(['tiktok', 'instagram', 'facebook', 'reddit']),
  /** Ranked hashtag recommendations */
  hashtags: z.array(hashtagRecommendationSchema),
  /** Estimated combined reach */
  totalReach: z.enum(['high', 'medium', 'low']),
  /** Count per category */
  mixBreakdown: z.object({
    trending: z.number(),
    niche: z.number(),
    branded: z.number(),
    evergreen: z.number(),
    community: z.number(),
  }),
})

export type PlatformHashtagSet = z.infer<typeof platformHashtagSetSchema>

/**
 * Full hashtag strategy output for a content item across platforms.
 */
export const hashtagStrategyOutputSchema = z.object({
  /** ID of the content item being optimized */
  contentItemId: z.string().min(1),
  /** One set per target platform */
  platformSets: z.array(platformHashtagSetSchema),
  /** Brief explanation of hashtag strategy chosen */
  strategy: z.string().min(1),
  /** Tags intentionally excluded with reasons */
  avoidedTags: z.array(z.string()),
})

export type HashtagStrategyOutput = z.infer<typeof hashtagStrategyOutputSchema>
