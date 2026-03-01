import {MATError} from './errors.js'

export interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
  source: string
  isPermanent?: (error: unknown) => boolean
}

export interface RetryResult<T> {
  result: T
  attempts: number
  elapsedMs: number
}

export interface RetryError extends Error {
  attempts: number
  elapsedMs: number
  source: string
  lastError: unknown
}

export const RETRY_PLATFORM_API: RetryOptions = {
  maxAttempts: 5,
  baseDelayMs: 2000,
  source: 'platform-api',
}

export const RETRY_AI_PROVIDER: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  source: 'ai-provider',
}

/**
 * Determine if an error is permanent (should not be retried).
 * HTTP 4xx (except 429) are permanent. MATError with severity 'permanent' are permanent.
 */
export function isPermanentError(error: unknown): boolean {
  if (error instanceof MATError) {
    return error.severity === 'permanent'
  }

  if (error && typeof error === 'object') {
    const statusCode = (error as Record<string, unknown>).statusCode ?? (error as Record<string, unknown>).status
    if (typeof statusCode === 'number') {
      // 429 is transient (rate limit), other 4xx are permanent
      if (statusCode === 429) return false
      if (statusCode >= 400 && statusCode < 500) return true
    }
  }

  return false
}

/**
 * Extract Retry-After header value from an error object.
 * Returns delay in milliseconds, or undefined if not present.
 */
export function extractRetryAfter(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const retryAfter = (error as Record<string, unknown>).retryAfter ?? (error as Record<string, unknown>).retryAfterMs
    if (typeof retryAfter === 'number' && retryAfter > 0) {
      return retryAfter
    }

    // Check for retryAfter as seconds string (HTTP Retry-After header format)
    if (typeof retryAfter === 'string') {
      const seconds = Number.parseFloat(retryAfter)
      if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1000
      }
    }
  }

  return undefined
}

/**
 * Retry a function with exponential backoff and jitter.
 * - Retries on transient errors up to maxAttempts
 * - Throws immediately on permanent errors
 * - Respects Retry-After headers when present
 * - Tracks total attempts and elapsed time
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const startTime = Date.now()

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const permanent = options.isPermanent?.(error) ?? isPermanentError(error)

      if (permanent || attempt === options.maxAttempts) {
        const retryError = new RetryExhaustedError(
          options.source,
          attempt,
          Date.now() - startTime,
          error,
        )
        throw retryError
      }

      const retryAfterMs = extractRetryAfter(error)
      const backoff = options.baseDelayMs * Math.pow(2, attempt - 1)
      const jitter = Math.random() * 500
      const delay = retryAfterMs ?? (backoff + jitter)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  // Unreachable but TypeScript needs it
  throw new Error('unreachable')
}

export class RetryExhaustedError extends MATError {
  public readonly attempts: number
  public readonly elapsedMs: number
  public readonly lastError: unknown

  constructor(source: string, attempts: number, elapsedMs: number, lastError: unknown) {
    const reason = lastError instanceof Error ? lastError.message : String(lastError)
    super(
      `Retry exhausted after ${attempts} attempt(s) in ${elapsedMs}ms: ${reason}`,
      'RETRY_EXHAUSTED',
      `All ${attempts} retry attempt(s) failed for '${source}'`,
      `Check the underlying error and retry manually if transient`,
      source,
      isPermanentError(lastError) ? 'permanent' : 'transient',
    )
    this.attempts = attempts
    this.elapsedMs = elapsedMs
    this.lastError = lastError
  }
}
