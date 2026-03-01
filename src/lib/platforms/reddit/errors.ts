import {MATError} from '../../utils/errors.js'

export class RedditApiError extends MATError {
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
      `Reddit API error (HTTP ${statusCode}): ${detail}`,
      'REDDIT_API_ERROR',
      `Reddit returned HTTP ${statusCode}: ${detail}`,
      resolution,
      'platforms/reddit',
      classification,
    )
  }
}

export class RedditSubmitError extends MATError {
  public readonly errors: string[][]

  constructor(errors: string[][]) {
    const messages = errors.map(([code, msg]) => `${code}: ${msg}`).join('; ')
    const firstCode = errors[0]?.[0] ?? 'UNKNOWN'
    const classification = classifyRedditErrorCode(firstCode)

    super(
      `Reddit submission rejected: ${messages}`,
      'REDDIT_SUBMIT_REJECTED',
      `Reddit rejected the submission: ${messages}`,
      classification === 'transient'
        ? 'This is a temporary issue. The request will be retried automatically.'
        : `Fix the content issue and try again. Error: ${messages}`,
      'platforms/reddit',
      classification,
    )
    this.errors = errors
  }
}

export class RedditAuthError extends MATError {
  constructor(detail: string) {
    super(
      `Reddit authentication failed: ${detail}`,
      'REDDIT_AUTH_FAILED',
      `Could not authenticate with Reddit: ${detail}`,
      `Run 'mat config platforms add reddit' to re-authenticate`,
      'platforms/reddit',
      'permanent',
    )
  }
}

export class RedditTokenRefreshError extends MATError {
  constructor(detail: string) {
    super(
      `Reddit token refresh failed: ${detail}`,
      'REDDIT_TOKEN_REFRESH_FAILED',
      `Could not refresh Reddit access token: ${detail}`,
      `Run 'mat config platforms add reddit' to re-authenticate`,
      'platforms/reddit',
      'permanent',
    )
  }
}

/**
 * Classify a Reddit error code as transient or permanent.
 */
export function classifyRedditErrorCode(code: string): 'transient' | 'permanent' {
  const transientCodes = new Set(['RATELIMIT'])
  if (transientCodes.has(code)) return 'transient'
  return 'permanent'
}

/**
 * Classify an HTTP status code from Reddit as transient or permanent.
 */
export function classifyHttpStatus(status: number): 'transient' | 'permanent' {
  if (status === 429) return 'transient'
  if (status >= 500 && status <= 599) return 'transient'
  return 'permanent'
}
