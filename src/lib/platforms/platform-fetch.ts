import {classifyError} from './error-classifier.js'
import type {ErrorClassification} from './error-classifier.js'
import {
  PlatformContentPolicyError,
  PlatformNetworkError,
  PlatformRateLimitError,
  PlatformTimeoutError,
} from './errors.js'
import type {RateLimitTracker} from './rate-limiter.js'
import type {PlatformName} from './types.js'
import {withRetry, RETRY_PLATFORM_API} from '../utils/retry.js'
import type {RetryOptions} from '../utils/retry.js'

export interface PlatformFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface PlatformFetchResult {
  status: number
  headers: Record<string, string>
  body: string
  ok: boolean
}

export interface CreatePlatformFetchOptions {
  retryOptions?: RetryOptions
}

/**
 * Create a fetch wrapper that integrates rate limiting, retry with backoff,
 * and error classification for a specific platform.
 *
 * Used by all platform adapter implementations (6.1b, 6.2, 6.3a, 6.3b).
 */
export function createPlatformFetch(
  platform: PlatformName,
  rateLimiter?: RateLimitTracker,
  options?: CreatePlatformFetchOptions,
) {
  const retryOptions = options?.retryOptions ?? {...RETRY_PLATFORM_API, source: `platform-api/${platform}`}

  return async function platformFetch(
    url: string,
    fetchOptions?: PlatformFetchOptions,
  ): Promise<PlatformFetchResult> {
    return withRetry(
      async () => {
        // Pre-request throttle
        if (rateLimiter) {
          await rateLimiter.throttle(platform)
        }

        let response: Response
        try {
          const controller = new AbortController()
          const timeoutMs = fetchOptions?.timeoutMs ?? 30_000
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

          response = await fetch(url, {
            method: fetchOptions?.method ?? 'GET',
            headers: fetchOptions?.headers,
            body: fetchOptions?.body,
            signal: controller.signal,
          })

          clearTimeout(timeoutId)
        } catch (error) {
          // Network-level errors
          const message = error instanceof Error ? error.message : String(error)

          if (message.includes('abort') || message.includes('AbortError')) {
            throw new PlatformTimeoutError(platform, fetchOptions?.timeoutMs ?? 30_000)
          }

          throw new PlatformNetworkError(platform, message)
        }

        // Update rate limit state from response headers
        if (rateLimiter) {
          const headerMap: Record<string, string> = {}
          response.headers.forEach((value, key) => {
            headerMap[key] = value
          })
          rateLimiter.updateFromHeaders(platform, headerMap)
        }

        const body = await response.text()

        if (!response.ok) {
          const classification = classifyError(platform, response.status, body)
          throwClassifiedError(platform, response.status, classification, body)
        }

        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          headers[key] = value
        })

        return {
          status: response.status,
          headers,
          body,
          ok: true,
        }
      },
      {
        ...retryOptions,
        isPermanent: (error) => {
          if (error instanceof PlatformContentPolicyError) return true
          if (error && typeof error === 'object' && 'severity' in error) {
            return (error as {severity: string}).severity === 'permanent'
          }

          return false
        },
      },
    )
  }
}

function throwClassifiedError(
  platform: PlatformName,
  statusCode: number,
  classification: ErrorClassification,
  body: string,
): never {
  if (statusCode === 429) {
    const resetAt = new Date(Date.now() + (classification.retryAfterMs ?? 60_000)).toISOString()
    throw Object.assign(
      new PlatformRateLimitError(platform, resetAt),
      {retryAfterMs: classification.retryAfterMs},
    )
  }

  if (classification.classification === 'permanent' && body.includes('policy')) {
    throw new PlatformContentPolicyError(platform, classification.resolution)
  }

  const error = new PlatformNetworkError(platform, `HTTP ${statusCode}: ${body.slice(0, 200)}`)
  if (classification.classification === 'transient') {
    throw error
  }

  // Permanent non-policy errors
  throw Object.assign(error, {severity: 'permanent' as const})
}
