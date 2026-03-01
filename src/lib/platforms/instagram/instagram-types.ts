import {z} from 'zod'

// --- Graph API Base (shared with Facebook, same platform) ---

export const GRAPH_API_BASE = 'https://graph.facebook.com/v24.0'

// --- Instagram Container Status ---

export const containerStatusSchema = z.enum([
  'IN_PROGRESS',
  'FINISHED',
  'PUBLISHED',
  'EXPIRED',
  'ERROR',
])

export type ContainerStatus = z.infer<typeof containerStatusSchema>

// --- Create Container Response ---

export const instagramContainerResponseSchema = z.object({
  id: z.string(),
})

export type InstagramContainerResponse = z.infer<typeof instagramContainerResponseSchema>

// --- Container Status Check Response ---

export const instagramContainerStatusResponseSchema = z.object({
  id: z.string().optional(),
  status_code: containerStatusSchema,
})

export type InstagramContainerStatusResponse = z.infer<typeof instagramContainerStatusResponseSchema>

// --- Media Publish Response ---

export const instagramMediaPublishResponseSchema = z.object({
  id: z.string(),
})

export type InstagramMediaPublishResponse = z.infer<typeof instagramMediaPublishResponseSchema>

// --- Publishing Limit Response ---

export const instagramPublishingLimitSchema = z.object({
  config: z.object({
    quota_total: z.number(),
    quota_duration: z.number().optional(),
  }).optional(),
  quota_usage: z.number(),
})

export type InstagramPublishingLimit = z.infer<typeof instagramPublishingLimitSchema>

// --- Instagram Business Account Discovery ---

export const instagramBusinessAccountResponseSchema = z.object({
  instagram_business_account: z.object({
    id: z.string(),
  }).optional(),
  id: z.string(),
})

export type InstagramBusinessAccountResponse = z.infer<typeof instagramBusinessAccountResponseSchema>

// --- Instagram Graph API Error Response (same structure as Facebook) ---

export const instagramGraphErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    code: z.number(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
})

export type InstagramGraphError = z.infer<typeof instagramGraphErrorSchema>

// --- Instagram Media Metrics ---

export const instagramMediaMetricsSchema = z.object({
  id: z.string(),
  like_count: z.number().optional(),
  comments_count: z.number().optional(),
  impressions: z.number().optional(),
  reach: z.number().optional(),
  saved: z.number().optional(),
  shares: z.number().optional(),
})

export type InstagramMediaMetrics = z.infer<typeof instagramMediaMetricsSchema>

// --- Error Classification Map ---

export const INSTAGRAM_ERROR_CLASSIFICATION: Record<number, 'transient' | 'permanent'> = {
  4: 'transient',        // Application rate limit — throttle and retry
  9: 'transient',        // Publishing limit reached — wait 24h
  32: 'transient',       // Daily action limit — wait
  190: 'permanent',      // Token expired/invalidated — re-authenticate
  200: 'permanent',      // Missing instagram_content_publish permission
  10: 'permanent',       // API permission denied
  36003: 'permanent',    // Invalid aspect ratio — resize media
  36001: 'permanent',    // Resolution too high — downscale
  9004: 'permanent',     // Invalid media format/codec
  2207026: 'permanent',  // Container processing error — re-upload
}

// --- Error Resolution Map ---

export const INSTAGRAM_ERROR_RESOLUTIONS: Record<number, string> = {
  4: 'Application rate limit reached. Throttling requests and retrying.',
  9: 'Publishing limit reached (50 posts/24h). Wait before publishing again.',
  32: 'Daily action limit reached. Wait before performing more actions.',
  190: "Access token is invalid or expired. Run 'mat config platforms add instagram' to re-authenticate.",
  200: "Missing instagram_content_publish permission. Re-authenticate with required scopes.",
  10: "API permission denied. Ensure the app has required Instagram permissions.",
  36003: 'Invalid aspect ratio. Instagram requires 4:5 to 1.91:1. Resize media and try again.',
  36001: 'Image resolution too high. Downscale the image and try again.',
  9004: 'Invalid media format or codec. Use MP4/MOV for video. Re-encode and try again.',
  2207026: 'Container processing error. Re-upload the media and try again.',
}

// --- Constants ---

export const INSTAGRAM_CAPTION_MAX_LENGTH = 2200
export const INSTAGRAM_HASHTAG_MAX_COUNT = 30
export const INSTAGRAM_CAROUSEL_MAX_ITEMS = 10
export const INSTAGRAM_CAROUSEL_VIDEO_MAX_SECONDS = 60
export const INSTAGRAM_REELS_MAX_SECONDS = 900 // 15 minutes
export const INSTAGRAM_REELS_MIN_SECONDS = 3
export const INSTAGRAM_VIDEO_MAX_SIZE_MB = 100
export const INSTAGRAM_API_CALLS_PER_HOUR = 200
export const INSTAGRAM_POSTS_PER_DAY = 50
export const INSTAGRAM_CONTAINER_EXPIRY_HOURS = 24
export const INSTAGRAM_CONTAINER_POLL_INTERVAL_MS = 10_000 // 10 seconds
export const INSTAGRAM_CONTAINER_POLL_TIMEOUT_MS = 300_000 // 5 minutes
export const INSTAGRAM_ASPECT_RATIO_MIN = 4 / 5   // 0.8 (portrait)
export const INSTAGRAM_ASPECT_RATIO_MAX = 1.91     // landscape

// --- Rate Limit State ---

export interface InstagramRateLimitState {
  apiCallCount: number
  apiCallsResetAt: number // epoch ms
  publishCount: number
  publishResetAt: number // epoch ms
  updatedAt: number // epoch ms
}

// --- Instagram Account Info ---

export interface InstagramAccountInfo {
  igUserId: string
  pageId: string
  pageAccessToken: string
  pageName: string
  accountType?: string
}
