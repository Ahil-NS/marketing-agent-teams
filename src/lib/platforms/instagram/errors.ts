import {MATError} from '../../utils/errors.js'
import {INSTAGRAM_ERROR_CLASSIFICATION, INSTAGRAM_ERROR_RESOLUTIONS} from './instagram-types.js'

export class InstagramApiError extends MATError {
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
      `Instagram API error (HTTP ${statusCode}): ${detail}`,
      'INSTAGRAM_API_ERROR',
      `Instagram returned HTTP ${statusCode}: ${detail}`,
      resolution,
      'platforms/instagram',
      classification,
    )
  }
}

export class InstagramAuthError extends MATError {
  constructor(detail: string) {
    super(
      `Instagram authentication failed: ${detail}`,
      'INSTAGRAM_AUTH_FAILED',
      `Could not authenticate with Instagram: ${detail}`,
      `Run 'mat config platforms add instagram' to re-authenticate`,
      'platforms/instagram',
      'permanent',
    )
  }
}

export class InstagramAccountDiscoveryError extends MATError {
  constructor(detail: string) {
    super(
      `Instagram account discovery failed: ${detail}`,
      'INSTAGRAM_ACCOUNT_DISCOVERY_FAILED',
      `Could not discover Instagram Business/Creator account: ${detail}`,
      `Ensure you have a Facebook Page linked to an Instagram Business or Creator account, then run 'mat config platforms add instagram'`,
      'platforms/instagram',
      'permanent',
    )
  }
}

export class InstagramPersonalAccountError extends MATError {
  constructor() {
    super(
      'Personal Instagram accounts are not supported',
      'INSTAGRAM_PERSONAL_ACCOUNT',
      'The linked Instagram account is a Personal account, not Business or Creator',
      `Convert your Instagram account to a Business or Creator account, then run 'mat config platforms add instagram'`,
      'platforms/instagram',
      'permanent',
    )
  }
}

export class InstagramPublishError extends MATError {
  public readonly errorCode: number

  constructor(errorCode: number, detail: string, classification: 'transient' | 'permanent') {
    const resolution = INSTAGRAM_ERROR_RESOLUTIONS[errorCode]
      ?? (classification === 'transient'
        ? 'This is a temporary issue. The request will be retried automatically.'
        : `Fix the issue and try again. Run 'mat review' to re-approve content.`)

    super(
      `Instagram publish failed [code ${errorCode}]: ${detail}`,
      'INSTAGRAM_PUBLISH_FAILED',
      `Instagram rejected the publish: ${detail}`,
      resolution,
      'platforms/instagram',
      classification,
    )
    this.errorCode = errorCode
  }
}

export class InstagramContainerExpiredError extends MATError {
  constructor(containerId: string) {
    super(
      `Instagram container ${containerId} has expired`,
      'INSTAGRAM_CONTAINER_EXPIRED',
      'The media container expired before it could be published (24-hour limit)',
      'Re-create the media container and publish within 24 hours',
      'platforms/instagram',
      'permanent',
    )
  }
}

export class InstagramContainerProcessingError extends MATError {
  constructor(containerId: string) {
    super(
      `Instagram container ${containerId} failed processing`,
      'INSTAGRAM_CONTAINER_PROCESSING_FAILED',
      'The media container failed during server-side processing',
      'Re-upload the media — check format (MP4/MOV for video), resolution, and file size (max 100MB)',
      'platforms/instagram',
      'permanent',
    )
  }
}

export class InstagramPublishingLimitError extends MATError {
  constructor(quotaUsage: number, quotaTotal: number) {
    super(
      `Instagram publishing limit reached: ${quotaUsage}/${quotaTotal}`,
      'INSTAGRAM_PUBLISHING_LIMIT',
      `Publishing quota exhausted (${quotaUsage} of ${quotaTotal} posts used in 24h window)`,
      'Wait for the publishing window to reset (24 hours) before publishing more content',
      'platforms/instagram',
      'transient',
    )
  }
}

/**
 * Classify an Instagram Graph API error code as transient or permanent.
 */
export function classifyInstagramErrorCode(code: number): 'transient' | 'permanent' {
  return INSTAGRAM_ERROR_CLASSIFICATION[code] ?? 'permanent'
}

/**
 * Classify an HTTP status code as transient or permanent.
 */
export function classifyHttpStatus(status: number): 'transient' | 'permanent' {
  if (status === 429) return 'transient'
  if (status >= 500 && status <= 599) return 'transient'
  return 'permanent'
}
