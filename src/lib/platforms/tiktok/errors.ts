import {MATError} from '../../utils/errors.js'
import {TIKTOK_ERROR_CLASSIFICATION} from './tiktok-types.js'

export class TikTokApiError extends MATError {
  constructor(
    statusCode: number,
    detail: string,
    classification: 'transient' | 'permanent',
  ) {
    const resolution =
      classification === 'transient'
        ? 'This is a temporary issue. The request will be retried automatically.'
        : `Fix the issue and try again. Run 'mat review' to re-approve content.`

    super(
      `TikTok API error (HTTP ${statusCode}): ${detail}`,
      'TIKTOK_API_ERROR',
      `TikTok returned HTTP ${statusCode}: ${detail}`,
      resolution,
      'platforms/tiktok',
      classification,
    )
  }
}

export class TikTokAuthError extends MATError {
  constructor(detail: string) {
    super(
      `TikTok authentication failed: ${detail}`,
      'TIKTOK_AUTH_FAILED',
      `Could not authenticate with TikTok: ${detail}`,
      `Run 'mat config platforms add tiktok' to re-authenticate`,
      'platforms/tiktok',
      'permanent',
    )
  }
}

export class TikTokTokenRefreshError extends MATError {
  constructor(detail: string) {
    super(
      `TikTok token refresh failed: ${detail}`,
      'TIKTOK_TOKEN_REFRESH_FAILED',
      `Could not refresh TikTok access token: ${detail}`,
      `Run 'mat config platforms add tiktok' to re-authenticate`,
      'platforms/tiktok',
      'permanent',
    )
  }
}

export class TikTokPublishError extends MATError {
  public readonly errorCode: string

  constructor(errorCode: string, detail: string, classification: 'transient' | 'permanent') {
    const resolution = getResolutionForCode(errorCode, classification)

    super(
      `TikTok publish failed [${errorCode}]: ${detail}`,
      'TIKTOK_PUBLISH_FAILED',
      `TikTok rejected the publish: ${detail}`,
      resolution,
      'platforms/tiktok',
      classification,
    )
    this.errorCode = errorCode
  }
}

export class TikTokCreatorInfoError extends MATError {
  constructor(detail: string) {
    super(
      `TikTok creator info query failed: ${detail}`,
      'TIKTOK_CREATOR_INFO_FAILED',
      `Could not retrieve TikTok creator info: ${detail}`,
      'Ensure your TikTok app has the required scopes and the creator account is active',
      'platforms/tiktok',
      'transient',
    )
  }
}

/**
 * Classify a TikTok API error code as transient or permanent.
 */
export function classifyTikTokErrorCode(code: string): 'transient' | 'permanent' {
  return TIKTOK_ERROR_CLASSIFICATION[code] ?? 'permanent'
}

/**
 * Classify an HTTP status code as transient or permanent.
 */
export function classifyHttpStatus(status: number): 'transient' | 'permanent' {
  if (status === 429) return 'transient'
  if (status >= 500 && status <= 599) return 'transient'
  return 'permanent'
}

/**
 * Get a human-readable resolution message for a TikTok error code.
 */
function getResolutionForCode(code: string, classification: 'transient' | 'permanent'): string {
  switch (code) {
    case 'rate_limit_exceeded':
      return 'Wait and retry. Rate limit will reset within 1 minute.'
    case 'spam_risk_too_many_pending_share':
      return 'Wait 24 hours for pending uploads to clear. Max 5 pending uploads per day.'
    case 'token_expired':
      return `Re-authenticate via 'mat config platforms add tiktok'.`
    case 'privacy_level_option_mismatch':
      return 'Use creator info to get valid privacy levels. Query /v2/post/publish/creator_info/query/ first.'
    case 'url_ownership_unverified':
      return 'Verify domain ownership in TikTok Developer Portal.'
    case 'unaudited_client_can_only_post_to_private_accounts':
      return 'Complete TikTok app audit. Until audited, only SELF_ONLY privacy is allowed and user accounts must be private.'
    default:
      return classification === 'transient'
        ? 'This is a temporary issue. The request will be retried automatically.'
        : `Fix the issue and try again. Run 'mat review' to re-approve content.`
  }
}
