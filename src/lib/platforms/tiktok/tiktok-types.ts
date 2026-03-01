import {z} from 'zod'

// --- TikTok API Base ---
export const TIKTOK_API_BASE = 'https://open.tiktokapis.com'

// --- TikTok OAuth Token Response ---

export const tiktokTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(), // seconds, typically 86400 (24h)
  open_id: z.string(),
  refresh_expires_in: z.number(), // seconds, typically 31536000 (365d)
  refresh_token: z.string(),
  scope: z.string(), // comma-separated
  token_type: z.string(),
})

export type TikTokTokenResponse = z.infer<typeof tiktokTokenResponseSchema>

// --- TikTok Creator Info ---

export const tiktokCreatorInfoSchema = z.object({
  data: z.object({
    creator_avatar_url: z.string().optional(),
    creator_username: z.string().optional(),
    creator_nickname: z.string().optional(),
    privacy_level_options: z.array(z.string()),
    comment_disabled: z.boolean().optional().default(false),
    duet_disabled: z.boolean().optional().default(false),
    stitch_disabled: z.boolean().optional().default(false),
    max_video_post_duration_sec: z.number().optional().default(600),
  }),
  error: z.object({
    code: z.string(),
    message: z.string(),
    log_id: z.string().optional(),
  }),
})

export type TikTokCreatorInfo = z.infer<typeof tiktokCreatorInfoSchema>

// --- TikTok Publish Init Response ---

export const tiktokPublishInitResponseSchema = z.object({
  data: z.object({
    publish_id: z.string(),
  }).nullable().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    log_id: z.string().optional(),
  }),
})

export type TikTokPublishInitResponse = z.infer<typeof tiktokPublishInitResponseSchema>

// --- TikTok Publish Status Response ---

export const tiktokPublishStatusSchema = z.object({
  data: z.object({
    status: z.string(), // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, PUBLISH_COMPLETE, FAILED
    fail_reason: z.string().optional().default(''),
    publicaly_available_post_id: z.array(z.string()).optional().default([]),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    log_id: z.string().optional(),
  }),
})

export type TikTokPublishStatus = z.infer<typeof tiktokPublishStatusSchema>

// --- TikTok Video Query Response (for metrics) ---

export const tiktokVideoQueryResponseSchema = z.object({
  data: z.object({
    videos: z.array(z.object({
      id: z.string(),
      title: z.string().optional().default(''),
      video_description: z.string().optional().default(''),
      like_count: z.number().optional().default(0),
      comment_count: z.number().optional().default(0),
      share_count: z.number().optional().default(0),
      view_count: z.number().optional().default(0),
    })).optional().default([]),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    log_id: z.string().optional(),
  }),
})

export type TikTokVideoQueryResponse = z.infer<typeof tiktokVideoQueryResponseSchema>

// --- TikTok Rate Limit Tracking ---

export interface TikTokRateLimitState {
  /** Requests remaining in current window */
  remaining: number
  /** Epoch ms when rate limit window resets */
  resetAt: number
  /** Pending uploads in the last 24 hours */
  pendingUploads: number
  /** Epoch ms when pending uploads window resets */
  pendingUploadsResetAt: number
}

// --- TikTok Error Classification Map ---

export type TikTokErrorCode = string

/** Mapping of TikTok API error codes to transient/permanent classification */
export const TIKTOK_ERROR_CLASSIFICATION: Record<string, 'transient' | 'permanent'> = {
  'ok': 'permanent', // not really an error
  'rate_limit_exceeded': 'transient',
  'spam_risk_too_many_pending_share': 'transient',
  'token_expired': 'permanent',
  'privacy_level_option_mismatch': 'permanent',
  'url_ownership_unverified': 'permanent',
  'unaudited_client_can_only_post_to_private_accounts': 'permanent',
  'scope_not_authorized': 'permanent',
  'invalid_publish_id': 'permanent',
  'access_token_invalid': 'permanent',
  'invalid_params': 'permanent',
}

// --- TikTok Rate Limit Constants ---

export const TIKTOK_RATE_LIMITS = {
  PUBLISH_VIDEO_INIT: {requestsPerMinute: 6},
  PUBLISH_CONTENT_INIT: {requestsPerMinute: 6},
  CREATOR_INFO_QUERY: {requestsPerMinute: 20},
  STATUS_FETCH: {requestsPerMinute: 30},
  MAX_PENDING_UPLOADS_PER_DAY: 5,
} as const

// --- TikTok Publish Request Params ---

export interface TikTokPublishParams {
  post_info: {
    title: string
    description?: string
    privacy_level: string
    disable_duet?: boolean
    disable_stitch?: boolean
    disable_comment?: boolean
    video_cover_timestamp_ms?: number
    brand_content_toggle?: boolean
    brand_organic_toggle?: boolean
    is_aigc?: boolean
  }
  source_info: {
    source: 'PULL_FROM_URL'
    video_url: string
  }
}
