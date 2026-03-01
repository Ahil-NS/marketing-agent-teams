import type {PlatformName} from './types.js'

export type ErrorClassificationType = 'transient' | 'permanent'

export interface ErrorClassification {
  classification: ErrorClassificationType
  retryable: boolean
  retryAfterMs?: number
  resolution: string
}

interface PlatformErrorMapping {
  pattern: string | RegExp
  classification: ErrorClassificationType
  resolution: string
}

const REDDIT_ERROR_MAP: PlatformErrorMapping[] = [
  {pattern: 'RATELIMIT', classification: 'transient', resolution: 'Reddit posting cooldown — wait and retry automatically'},
  {pattern: 'SUBMIT_VALIDATION', classification: 'permanent', resolution: 'Reddit submission validation failed — check content format'},
  {pattern: 'SUBREDDIT_NOTALLOWED', classification: 'permanent', resolution: 'Reddit subreddit not allowed — check subreddit rules and permissions'},
  {pattern: 'USER_REQUIRED', classification: 'permanent', resolution: 'Reddit authentication required — re-authenticate with "mat config platforms add reddit"'},
  {pattern: 'BANNED_FROM_SUBREDDIT', classification: 'permanent', resolution: 'Reddit account banned from subreddit — choose a different subreddit'},
]

const TIKTOK_ERROR_MAP: PlatformErrorMapping[] = [
  {pattern: 'spam_risk_too_many_posts', classification: 'transient', resolution: 'TikTok spam protection triggered — reduce posting frequency and retry'},
  {pattern: 'token_expired', classification: 'permanent', resolution: 'TikTok token expired — re-authenticate with "mat config platforms add tiktok"'},
  {pattern: 'invalid_access_token', classification: 'permanent', resolution: 'TikTok access token invalid — re-authenticate with "mat config platforms add tiktok"'},
  {pattern: 'rate_limit_exceeded', classification: 'transient', resolution: 'TikTok rate limit exceeded — wait for reset and retry'},
]

const FACEBOOK_ERROR_MAP: PlatformErrorMapping[] = [
  {pattern: /(#4)\b/, classification: 'transient', resolution: 'Facebook API rate limit reached — wait for throttle window to reset'},
  {pattern: /(#200)\b/, classification: 'permanent', resolution: 'Facebook permissions error — check app permissions and page access tokens'},
  {pattern: /(#190)\b/, classification: 'permanent', resolution: 'Facebook access token invalid or expired — re-authenticate with "mat config platforms add facebook"'},
  {pattern: /(#1)\b/, classification: 'transient', resolution: 'Facebook API unknown error — retry the request'},
  {pattern: /(#2)\b/, classification: 'transient', resolution: 'Facebook API service temporarily unavailable — retry after delay'},
  {pattern: /(#368)\b/, classification: 'permanent', resolution: 'Facebook content blocked by security policy — review content for policy compliance'},
]

const INSTAGRAM_ERROR_MAP: PlatformErrorMapping[] = [
  {pattern: /(#9)\b/, classification: 'transient', resolution: 'Instagram too many API calls — wait for throttle window to reset'},
  {pattern: /(#10)\b/, classification: 'permanent', resolution: 'Instagram API permission denied — check app permissions in Meta developer console'},
  {pattern: /(#100)\b/, classification: 'permanent', resolution: 'Instagram invalid parameter — check content format and media requirements'},
  {pattern: /(#190)\b/, classification: 'permanent', resolution: 'Instagram access token invalid or expired — re-authenticate with "mat config platforms add instagram"'},
]

const PLATFORM_ERROR_MAPS: Record<PlatformName, PlatformErrorMapping[]> = {
  reddit: REDDIT_ERROR_MAP,
  tiktok: TIKTOK_ERROR_MAP,
  facebook: FACEBOOK_ERROR_MAP,
  instagram: INSTAGRAM_ERROR_MAP,
}

/**
 * Classify an HTTP error/response as transient or permanent.
 * Uses a two-tier approach:
 * 1. Platform-specific error body matching (overrides HTTP status)
 * 2. HTTP status code baseline classification
 */
export function classifyError(
  platform: PlatformName,
  statusCode: number,
  errorBody?: string | Record<string, unknown>,
): ErrorClassification {
  // Tier 1: Platform-specific error body matching
  if (errorBody) {
    const bodyStr = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody)
    const platformMap = PLATFORM_ERROR_MAPS[platform]

    for (const mapping of platformMap) {
      const matches = typeof mapping.pattern === 'string'
        ? bodyStr.includes(mapping.pattern)
        : mapping.pattern.test(bodyStr)

      if (matches) {
        return {
          classification: mapping.classification,
          retryable: mapping.classification === 'transient',
          resolution: mapping.resolution,
        }
      }
    }
  }

  // Tier 2: HTTP status code baseline
  return classifyByStatusCode(platform, statusCode)
}

/**
 * Classify a network-level error (no HTTP status).
 */
export function classifyNetworkError(platform: PlatformName, errorMessage: string): ErrorClassification {
  const lowerMessage = errorMessage.toLowerCase()

  // All network errors are transient
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return {
      classification: 'transient',
      retryable: true,
      resolution: `${platform} request timed out — will retry with backoff`,
    }
  }

  if (lowerMessage.includes('dns') || lowerMessage.includes('getaddrinfo')) {
    return {
      classification: 'transient',
      retryable: true,
      resolution: `${platform} DNS resolution failed — check network connectivity and retry`,
    }
  }

  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('econnreset') || lowerMessage.includes('network')) {
    return {
      classification: 'transient',
      retryable: true,
      resolution: `${platform} network error — check connectivity and retry`,
    }
  }

  return {
    classification: 'transient',
    retryable: true,
    resolution: `${platform} connection error — will retry with backoff`,
  }
}

function classifyByStatusCode(platform: PlatformName, statusCode: number): ErrorClassification {
  // 429 = Rate Limited → transient
  if (statusCode === 429) {
    return {
      classification: 'transient',
      retryable: true,
      resolution: `${platform} rate limit exceeded — will retry after cooldown`,
    }
  }

  // 5xx = Server Error → transient
  if (statusCode >= 500 && statusCode < 600) {
    return {
      classification: 'transient',
      retryable: true,
      resolution: `${platform} server error (${statusCode}) — will retry with backoff`,
    }
  }

  // 401/403 = Auth error → permanent
  if (statusCode === 401 || statusCode === 403) {
    return {
      classification: 'permanent',
      retryable: false,
      resolution: `${platform} authentication failed (${statusCode}) — re-authenticate with "mat config platforms add ${platform}"`,
    }
  }

  // Other 4xx = Client error → permanent
  if (statusCode >= 400 && statusCode < 500) {
    return {
      classification: 'permanent',
      retryable: false,
      resolution: `${platform} request rejected (${statusCode}) — check content and parameters`,
    }
  }

  // Unknown status → transient (safe default)
  return {
    classification: 'transient',
    retryable: true,
    resolution: `${platform} unexpected response (${statusCode}) — will retry`,
  }
}
