import {MATError} from '../../utils/errors.js'
import {FACEBOOK_ERROR_CLASSIFICATION, FACEBOOK_ERROR_RESOLUTIONS} from './facebook-types.js'

export class FacebookApiError extends MATError {
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
      `Facebook API error (HTTP ${statusCode}): ${detail}`,
      'FACEBOOK_API_ERROR',
      `Facebook returned HTTP ${statusCode}: ${detail}`,
      resolution,
      'platforms/facebook',
      classification,
    )
  }
}

export class FacebookAuthError extends MATError {
  constructor(detail: string) {
    super(
      `Facebook authentication failed: ${detail}`,
      'FACEBOOK_AUTH_FAILED',
      `Could not authenticate with Facebook: ${detail}`,
      `Run 'mat config platforms add facebook' to re-authenticate`,
      'platforms/facebook',
      'permanent',
    )
  }
}

export class FacebookTokenExchangeError extends MATError {
  constructor(detail: string) {
    super(
      `Facebook token exchange failed: ${detail}`,
      'FACEBOOK_TOKEN_EXCHANGE_FAILED',
      `Could not exchange Facebook token: ${detail}`,
      `Run 'mat config platforms add facebook' to re-authenticate`,
      'platforms/facebook',
      'permanent',
    )
  }
}

export class FacebookPublishError extends MATError {
  public readonly errorCode: number

  constructor(errorCode: number, detail: string, classification: 'transient' | 'permanent') {
    const resolution = FACEBOOK_ERROR_RESOLUTIONS[errorCode]
      ?? (classification === 'transient'
        ? 'This is a temporary issue. The request will be retried automatically.'
        : `Fix the issue and try again. Run 'mat review' to re-approve content.`)

    super(
      `Facebook publish failed [code ${errorCode}]: ${detail}`,
      'FACEBOOK_PUBLISH_FAILED',
      `Facebook rejected the publish: ${detail}`,
      resolution,
      'platforms/facebook',
      classification,
    )
    this.errorCode = errorCode
  }
}

export class FacebookPageNotFoundError extends MATError {
  constructor() {
    super(
      'No Facebook Pages found for this account',
      'FACEBOOK_NO_PAGES',
      'No Pages are associated with the authenticated Facebook account',
      `Ensure you have admin access to at least one Facebook Page, then run 'mat config platforms add facebook'`,
      'platforms/facebook',
      'permanent',
    )
  }
}

export class FacebookDuplicatePostError extends MATError {
  constructor() {
    super(
      'Duplicate consecutive post detected',
      'FACEBOOK_DUPLICATE_POST',
      'Facebook blocks identical consecutive posts to the same Page',
      'Vary the content before posting again',
      'platforms/facebook',
      'permanent',
    )
  }
}

/**
 * Classify a Facebook Graph API error code as transient or permanent.
 */
export function classifyFacebookErrorCode(code: number): 'transient' | 'permanent' {
  return FACEBOOK_ERROR_CLASSIFICATION[code] ?? 'permanent'
}

/**
 * Classify an HTTP status code as transient or permanent.
 */
export function classifyHttpStatus(status: number): 'transient' | 'permanent' {
  if (status === 429) return 'transient'
  if (status >= 500 && status <= 599) return 'transient'
  return 'permanent'
}
