export type PlatformName = 'reddit' | 'tiktok' | 'facebook' | 'instagram'

export interface AuthResult {
  success: boolean
  platform: PlatformName
  scopes: string[]
  expiresAt?: string
  error?: string
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'carousel'
  url?: string
  prompt?: string
  altText?: string
}

export interface PlatformContent {
  itemId: string
  platform: PlatformName
  content: {
    title?: string
    body: string
    hashtags?: string[]
    media?: MediaAttachment[]
    platformMeta: Record<string, unknown>
  }
  scheduledTime?: string
}

export interface PlatformPublishError {
  code: string
  message: string
  classification: 'transient' | 'permanent'
  retryable: boolean
  retryAfterMs?: number
}

export interface PublishResult {
  success: boolean
  platform: PlatformName
  itemId: string
  postId?: string
  postUrl?: string
  publishedAt?: string
  error?: PlatformPublishError
}

export interface ContentValidationError {
  field: string
  constraint: string
  message: string
  value?: unknown
  limit?: number
}

export interface ContentValidationWarning {
  field: string
  message: string
}

export interface ContentValidationResult {
  valid: boolean
  platform: PlatformName
  errors: ContentValidationError[]
  warnings: ContentValidationWarning[]
}

export interface RateLimitStatus {
  platform: PlatformName
  remaining: number
  limit: number
  resetsAt: string
  windowType: 'minute' | 'hour' | 'day'
}

export interface PlatformMetrics {
  postId: string
  platform: PlatformName
  views?: number
  likes?: number
  comments?: number
  shares?: number
  engagementRate?: number
  retrievedAt: string
}

export interface PlatformConstraints {
  titleMaxLength?: number
  bodyMaxLength?: number
  captionMaxLength?: number
  postMaxLength?: number
  hashtagMaxCount?: number | null
  requiresTitle?: boolean
  requiresSubreddit?: boolean
  requiresMedia?: boolean
  tokenExpiryDays?: number
  tokenRefreshWarningDays?: number
  rateLimits: {
    postsPerDay?: number | null
    requestsPerMinute?: number
    requestsPerHour?: number
  }
}

export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: PlatformName

  /** Authenticate with platform API using stored credentials */
  authenticate(): Promise<AuthResult>

  /** Validate content against platform-specific constraints before publishing */
  validateContent(content: PlatformContent): Promise<ContentValidationResult>

  /** Publish approved content to the platform */
  publish(content: PlatformContent): Promise<PublishResult>

  /** Get engagement metrics for published content */
  getMetrics(postId: string): Promise<PlatformMetrics>

  /** Get current rate limit status */
  getRateLimits(): Promise<RateLimitStatus>

  /** Disconnect and clean up credentials */
  disconnect(): Promise<void>
}
