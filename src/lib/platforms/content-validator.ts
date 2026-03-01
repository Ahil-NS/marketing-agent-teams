import type {
  ContentValidationError,
  ContentValidationResult,
  ContentValidationWarning,
  PlatformConstraints,
  PlatformContent,
  PlatformName,
} from './types.js'

export const PLATFORM_CONSTRAINTS: Record<PlatformName, PlatformConstraints> = {
  reddit: {
    titleMaxLength: 300,
    bodyMaxLength: 40_000,
    requiresTitle: true,
    requiresSubreddit: true,
    rateLimits: {postsPerDay: null, requestsPerMinute: 60},
  },
  tiktok: {
    captionMaxLength: 300,
    hashtagMaxCount: 30,
    requiresMedia: true,
    rateLimits: {postsPerDay: 15, requestsPerMinute: 6},
  },
  instagram: {
    captionMaxLength: 2200,
    hashtagMaxCount: 30,
    requiresMedia: true,
    tokenExpiryDays: 60,
    tokenRefreshWarningDays: 14,
    rateLimits: {postsPerDay: null, requestsPerHour: 200},
  },
  facebook: {
    postMaxLength: 63_206,
    hashtagMaxCount: null,
    rateLimits: {postsPerDay: 25, requestsPerHour: 200},
  },
}

export function validateContentForPlatform(content: PlatformContent): ContentValidationResult {
  const constraints = PLATFORM_CONSTRAINTS[content.platform]
  const errors: ContentValidationError[] = []
  const warnings: ContentValidationWarning[] = []

  // Body / caption / post length checks
  const bodyLength = content.content.body.length
  if (constraints.bodyMaxLength && bodyLength > constraints.bodyMaxLength) {
    errors.push({
      field: 'body',
      constraint: 'maxLength',
      message: `Body exceeds maximum length of ${constraints.bodyMaxLength} characters`,
      value: bodyLength,
      limit: constraints.bodyMaxLength,
    })
  }

  if (constraints.captionMaxLength && bodyLength > constraints.captionMaxLength) {
    errors.push({
      field: 'body',
      constraint: 'maxLength',
      message: `Caption exceeds maximum length of ${constraints.captionMaxLength} characters`,
      value: bodyLength,
      limit: constraints.captionMaxLength,
    })
  }

  if (constraints.postMaxLength && bodyLength > constraints.postMaxLength) {
    errors.push({
      field: 'body',
      constraint: 'maxLength',
      message: `Post exceeds maximum length of ${constraints.postMaxLength} characters`,
      value: bodyLength,
      limit: constraints.postMaxLength,
    })
  }

  // Title checks
  if (constraints.requiresTitle && !content.content.title) {
    errors.push({
      field: 'title',
      constraint: 'required',
      message: 'Title is required for this platform',
    })
  }

  if (constraints.titleMaxLength && content.content.title && content.content.title.length > constraints.titleMaxLength) {
    errors.push({
      field: 'title',
      constraint: 'maxLength',
      message: `Title exceeds maximum length of ${constraints.titleMaxLength} characters`,
      value: content.content.title.length,
      limit: constraints.titleMaxLength,
    })
  }

  // Subreddit check (Reddit-specific via platformMeta)
  if (constraints.requiresSubreddit && !content.content.platformMeta?.['subreddit']) {
    errors.push({
      field: 'platformMeta.subreddit',
      constraint: 'required',
      message: 'Subreddit is required for Reddit posts',
    })
  }

  // Media check
  if (constraints.requiresMedia && (!content.content.media || content.content.media.length === 0)) {
    errors.push({
      field: 'media',
      constraint: 'required',
      message: 'At least one media attachment is required for this platform',
    })
  }

  // Hashtag limit check
  if (constraints.hashtagMaxCount !== undefined && constraints.hashtagMaxCount !== null && content.content.hashtags) {
    if (content.content.hashtags.length > constraints.hashtagMaxCount) {
      errors.push({
        field: 'hashtags',
        constraint: 'maxCount',
        message: `Hashtag count exceeds maximum of ${constraints.hashtagMaxCount}`,
        value: content.content.hashtags.length,
        limit: constraints.hashtagMaxCount,
      })
    }
  }

  // Warnings
  if (content.content.body.length === 0) {
    warnings.push({
      field: 'body',
      message: 'Content body is empty',
    })
  }

  return {
    valid: errors.length === 0,
    platform: content.platform,
    errors,
    warnings,
  }
}
