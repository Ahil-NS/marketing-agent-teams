import {z} from 'zod'

// --- Graph API Base ---

export const GRAPH_API_BASE = 'https://graph.facebook.com/v24.0'

// --- Facebook Token Exchange Responses ---

export const facebookTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

export type FacebookTokenResponse = z.infer<typeof facebookTokenResponseSchema>

// --- Facebook Page Info (from /me/accounts) ---

export const facebookPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  access_token: z.string(),
  category: z.string().optional(),
  tasks: z.array(z.string()).optional(),
})

export const facebookMeAccountsSchema = z.object({
  data: z.array(facebookPageSchema),
  paging: z.object({
    cursors: z.object({
      before: z.string().optional(),
      after: z.string().optional(),
    }).optional(),
    next: z.string().optional(),
  }).optional(),
})

export type FacebookPage = z.infer<typeof facebookPageSchema>
export type FacebookMeAccounts = z.infer<typeof facebookMeAccountsSchema>

// --- Facebook Feed Post Response ---

export const facebookFeedPostResponseSchema = z.object({
  id: z.string(), // format: {page-id}_{post-id}
})

export type FacebookFeedPostResponse = z.infer<typeof facebookFeedPostResponseSchema>

// --- Facebook Photo Upload Response ---

export const facebookPhotoUploadResponseSchema = z.object({
  id: z.string(),
  post_id: z.string().optional(),
})

export type FacebookPhotoUploadResponse = z.infer<typeof facebookPhotoUploadResponseSchema>

// --- Facebook Graph API Error Response ---

export const facebookGraphErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    code: z.number(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
})

export type FacebookGraphError = z.infer<typeof facebookGraphErrorSchema>

// --- Facebook Post Metrics (engagement) ---

export const facebookPostMetricsSchema = z.object({
  id: z.string(),
  likes: z.object({
    summary: z.object({
      total_count: z.number(),
    }),
  }).optional(),
  comments: z.object({
    summary: z.object({
      total_count: z.number(),
    }),
  }).optional(),
  shares: z.object({
    count: z.number(),
  }).optional(),
})

export type FacebookPostMetrics = z.infer<typeof facebookPostMetricsSchema>

// --- X-App-Usage Header (percentage-based rate limiting) ---

export const facebookAppUsageSchema = z.object({
  call_count: z.number(),
  total_cputime: z.number(),
  total_time: z.number(),
})

export type FacebookAppUsage = z.infer<typeof facebookAppUsageSchema>

// --- Rate Limit State ---

export interface FacebookRateLimitState {
  callCount: number
  totalCpuTime: number
  totalTime: number
  updatedAt: number // epoch ms
  pageCallsRemaining: number
  pageCallsResetAt: number // epoch ms
}

// --- Error Classification Map ---

export const FACEBOOK_ERROR_CLASSIFICATION: Record<number, 'transient' | 'permanent'> = {
  2: 'transient',     // Service temporarily unavailable
  4: 'transient',     // Application rate limit
  32: 'transient',    // Page rate limit
  190: 'permanent',   // Token expired/invalidated
  200: 'permanent',   // Insufficient permissions
  368: 'permanent',   // Content blocked by security policy
  506: 'permanent',   // Duplicate post
  100: 'permanent',   // Invalid parameter
}

// --- Error Resolution Map ---

export const FACEBOOK_ERROR_RESOLUTIONS: Record<number, string> = {
  2: 'Facebook service is temporarily unavailable. The request will be retried automatically.',
  4: 'Application rate limit reached. Throttling requests and retrying.',
  32: 'Page rate limit reached. Wait before posting to this Page again.',
  190: "Page Access Token is invalid or expired. Run 'mat config platforms add facebook' to re-authenticate.",
  200: "Insufficient permissions. Re-authenticate with required scopes: 'mat config platforms add facebook'.",
  368: 'Content blocked by Facebook security policy. Review content for policy violations and modify.',
  506: 'Duplicate post detected. Facebook blocks identical consecutive posts. Vary the content.',
  100: 'Invalid parameter in the API request. Check content format and field values.',
}

// --- Constants ---

export const FACEBOOK_THROTTLE_THRESHOLD = 80 // percentage
export const FACEBOOK_PAGE_CALLS_PER_DAY = 4800
export const FACEBOOK_POST_MAX_LENGTH = 63_206
