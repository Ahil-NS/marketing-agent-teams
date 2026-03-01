import {z} from 'zod'

/**
 * Platform-specific hashtag limits: min, max, and recommended count per post.
 */
export const PLATFORM_HASHTAG_LIMITS: Record<string, {min: number; max: number; recommended: number}> = {
  tiktok: {min: 3, max: 8, recommended: 5},
  instagram: {min: 5, max: 30, recommended: 15},
  facebook: {min: 1, max: 10, recommended: 3},
  reddit: {min: 0, max: 0, recommended: 0}, // Reddit does not use hashtags
}

/**
 * Target percentage mix breakdown by hashtag category per platform.
 * Values represent ideal percentage of each category in a hashtag set.
 */
export const HASHTAG_MIX_TARGETS: Record<string, {trending: number; niche: number; branded: number; evergreen: number; community: number}> = {
  tiktok: {trending: 40, niche: 30, branded: 10, evergreen: 10, community: 10},
  instagram: {trending: 25, niche: 35, branded: 15, evergreen: 15, community: 10},
  facebook: {trending: 50, niche: 20, branded: 20, evergreen: 10, community: 0},
  reddit: {trending: 0, niche: 0, branded: 0, evergreen: 0, community: 0},
}

/**
 * Validation schema for platform hashtag limit entries.
 */
export const hashtagLimitSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
  recommended: z.number().int().min(0),
}).refine((d) => d.min <= d.max, {message: 'min must be <= max'})
  .refine((d) => d.recommended >= d.min && d.recommended <= d.max, {message: 'recommended must be between min and max'})

/**
 * Validation schema for hashtag mix target entries (percentages should sum to 100 or 0).
 */
export const hashtagMixTargetSchema = z.object({
  trending: z.number().min(0).max(100),
  niche: z.number().min(0).max(100),
  branded: z.number().min(0).max(100),
  evergreen: z.number().min(0).max(100),
  community: z.number().min(0).max(100),
})

/**
 * Combined config schema for a platform's hashtag configuration.
 */
export const hashtagConfigSchema = z.object({
  limits: hashtagLimitSchema,
  mixTargets: hashtagMixTargetSchema,
})

export type HashtagLimit = z.infer<typeof hashtagLimitSchema>
export type HashtagMixTarget = z.infer<typeof hashtagMixTargetSchema>
export type HashtagConfig = z.infer<typeof hashtagConfigSchema>

// Validate all configs at module load time (fail-fast on config errors)
for (const [platform, limits] of Object.entries(PLATFORM_HASHTAG_LIMITS)) {
  const result = hashtagLimitSchema.safeParse(limits)
  if (!result.success) {
    throw new Error(`Invalid hashtag limits for platform '${platform}': ${result.error.message}`)
  }
}

for (const [platform, targets] of Object.entries(HASHTAG_MIX_TARGETS)) {
  const result = hashtagMixTargetSchema.safeParse(targets)
  if (!result.success) {
    throw new Error(`Invalid hashtag mix targets for platform '${platform}': ${result.error.message}`)
  }
}
