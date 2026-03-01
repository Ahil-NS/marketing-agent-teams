import {MATError} from '../utils/errors.js'
import {
  tiktokSeoConfigSchema,
  redditSeoConfigSchema,
  facebookSeoConfigSchema,
  instagramSeoConfigSchema,
} from '../schemas/seo-schema.js'
import type {PlatformSeoConfig, TikTokSeoConfig, RedditSeoConfig, FacebookSeoConfig, InstagramSeoConfig} from '../schemas/seo-schema.js'

const TIKTOK_SEO_CONFIG: TikTokSeoConfig = {
  platform: 'tiktok',
  keywordDensity: {min: 0.01, max: 0.03, target: 0.02},
  hashtagRange: {min: 3, max: 5},
  altTextRequired: false,
  structuredData: false,
  rankingSignals: ['watch-time', 'shares', 'comments', 'profile-visits', 'saves'],
  charLimits: {
    body: {max: 4000, optimal: 150},
    caption: {max: 4000, optimal: 150},
  },
  indexableLayers: {
    captionText: {
      maxChars: 4000,
      keywordPlacement: 'Keywords in first line of caption for maximum indexing weight',
    },
    ocrTextOverlay: {
      enabled: true,
      keywordInclusion: true,
    },
    audioKeywords: {
      firstNSeconds: 5,
      keywordDensity: 'Include primary keyword in spoken audio within first 5 seconds',
    },
    hashtags: {
      count: {min: 3, max: 5},
      avoidGeneric: ['#fyp', '#foryou', '#foryoupage', '#viral'],
    },
  },
}

const REDDIT_SEO_CONFIG: RedditSeoConfig = {
  platform: 'reddit',
  keywordDensity: {min: 0.005, max: 0.02, target: 0.01},
  hashtagRange: {min: 0, max: 0},
  altTextRequired: false,
  structuredData: false,
  rankingSignals: ['upvotes', 'comment-count', 'awards', 'crosspost-count'],
  charLimits: {
    title: {max: 300, optimal: 60},
    body: {max: 40000, optimal: 400},
  },
  titleKeywordFrontLoading: true,
  optimalPostWordCount: {min: 300, max: 500},
  googleSearchVisibility: true,
}

const FACEBOOK_SEO_CONFIG: FacebookSeoConfig = {
  platform: 'facebook',
  keywordDensity: {min: 0.005, max: 0.02, target: 0.01},
  hashtagRange: {min: 1, max: 2},
  altTextRequired: false,
  structuredData: false,
  rankingSignals: ['comments', 'shares', 'reactions', 'video-watch-time'],
  charLimits: {
    body: {max: 63206, optimal: 60},
  },
  commentWeightOptimization: true,
  videoPreferenceSignal: true,
}

const INSTAGRAM_SEO_CONFIG: InstagramSeoConfig = {
  platform: 'instagram',
  keywordDensity: {min: 0.01, max: 0.03, target: 0.02},
  hashtagRange: {min: 3, max: 5},
  altTextRequired: true,
  altTextCharLimit: {max: 125, optimal: 110},
  structuredData: false,
  rankingSignals: ['saves', 'shares', 'comments', 'profile-visits', 'follows'],
  charLimits: {
    body: {max: 2200, optimal: 150, visiblePreview: 125},
  },
  savesSharesWeight: 'Saves and shares are weighted highest by Instagram algorithm (2026)',
  captionKeywordZone: {
    visibleChars: 125,
    keywordPlacement: 'Place primary keywords within first 125 visible characters before "more" truncation',
  },
}

// Validate all configs at module load time (fail-fast on config errors)
tiktokSeoConfigSchema.parse(TIKTOK_SEO_CONFIG)
redditSeoConfigSchema.parse(REDDIT_SEO_CONFIG)
facebookSeoConfigSchema.parse(FACEBOOK_SEO_CONFIG)
instagramSeoConfigSchema.parse(INSTAGRAM_SEO_CONFIG)

const PLATFORM_CONFIGS: Record<string, PlatformSeoConfig> = {
  tiktok: TIKTOK_SEO_CONFIG,
  reddit: REDDIT_SEO_CONFIG,
  facebook: FACEBOOK_SEO_CONFIG,
  instagram: INSTAGRAM_SEO_CONFIG,
}

/**
 * Get the default SEO configuration for a given platform.
 * Returns platform-specific SEO rules validated through Zod schema.
 *
 * @throws MATError with code SEO_CONFIG_NOT_FOUND for unsupported platforms
 */
export function getPlatformSeoConfig(platform: string): PlatformSeoConfig {
  const config = PLATFORM_CONFIGS[platform]
  if (!config) {
    throw new MATError(
      `No SEO configuration found for platform: ${platform}`,
      'SEO_CONFIG_NOT_FOUND',
      `Platform "${platform}" is not a supported SEO target`,
      `Supported platforms: ${Object.keys(PLATFORM_CONFIGS).join(', ')}`,
      'agents/seo-config',
      'permanent',
    )
  }

  return config
}
