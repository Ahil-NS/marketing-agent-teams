import {MATError} from '../utils/errors.js'

export class PlatformNotRegisteredError extends MATError {
  constructor(platform: string) {
    super(
      `Platform '${platform}' is not registered`,
      'PLATFORM_NOT_REGISTERED',
      `No adapter found for platform '${platform}'`,
      `Register the platform adapter or check supported platforms`,
      'platforms',
      'permanent',
    )
  }
}

export class PlatformAuthError extends MATError {
  constructor(platform: string, detail: string) {
    super(
      `Authentication failed for '${platform}': ${detail}`,
      'PLATFORM_AUTH_FAILED',
      `Could not authenticate with '${platform}'`,
      `Run 'mat config platforms add ${platform}' to re-authenticate`,
      `platforms/${platform}`,
      'permanent',
    )
  }
}

export class ContentValidationFailedError extends MATError {
  constructor(platform: string, errorCount: number) {
    super(
      `Content validation failed for '${platform}': ${errorCount} error(s)`,
      'PLATFORM_CONTENT_INVALID',
      `Content does not meet '${platform}' requirements`,
      `Check validation errors and fix content before publishing`,
      `platforms/${platform}`,
      'permanent',
    )
  }
}

export class PlatformPublishFailedError extends MATError {
  constructor(platform: string, classification: 'transient' | 'permanent', detail: string) {
    super(
      `Publish to '${platform}' failed: ${detail}`,
      'PLATFORM_PUBLISH_FAILED',
      `Could not publish content to '${platform}'`,
      classification === 'transient'
        ? `Will retry automatically. Check 'mat status' for retry queue.`
        : `Fix the issue and retry manually. Run 'mat review' to re-approve.`,
      `platforms/${platform}`,
      classification,
    )
  }
}

export class PlatformRateLimitError extends MATError {
  constructor(platform: string, resetsAt: string) {
    super(
      `Rate limit exceeded for '${platform}', resets at ${resetsAt}`,
      'PLATFORM_RATE_LIMITED',
      `Rate limit reached for '${platform}'`,
      `Wait until ${resetsAt} or check 'mat status' for queue`,
      `platforms/${platform}`,
      'transient',
    )
  }
}
