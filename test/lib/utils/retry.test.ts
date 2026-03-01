import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {MATError} from '../../../src/lib/utils/errors.js'
import {
  extractRetryAfter,
  isPermanentError,
  RETRY_AI_PROVIDER,
  RETRY_PLATFORM_API,
  RetryExhaustedError,
  withRetry,
} from '../../../src/lib/utils/retry.js'
import type {RetryOptions} from '../../../src/lib/utils/retry.js'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const options: RetryOptions = {maxAttempts: 3, baseDelayMs: 1000, source: 'test'}

    const result = await withRetry(fn, options)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on transient error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success')
    const options: RetryOptions = {maxAttempts: 3, baseDelayMs: 100, source: 'test'}

    const promise = withRetry(fn, options)

    // Advance past the backoff delay (100ms * 2^0 + up to 500ms jitter)
    await vi.advanceTimersByTimeAsync(700)

    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('applies exponential backoff timing', async () => {
    const delays: number[] = []
    const originalSetTimeout = globalThis.setTimeout

    // Track delays by spying on setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: (...args: unknown[]) => void, ms?: number) => {
      if (ms && ms > 0) {
        delays.push(ms)
      }
      // Execute callback immediately for test speed
      cb()
      return 0 as unknown as ReturnType<typeof originalSetTimeout>
    })

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockRejectedValueOnce(new Error('fail3'))
      .mockResolvedValueOnce('done')

    const options: RetryOptions = {maxAttempts: 5, baseDelayMs: 1000, source: 'test'}
    const result = await withRetry(fn, options)

    expect(result).toBe('done')
    expect(fn).toHaveBeenCalledTimes(4)
    expect(delays).toHaveLength(3)

    // Verify exponential pattern: base * 2^(attempt-1) + jitter(0-500)
    // Attempt 1: 1000 * 2^0 = 1000 + jitter(0-500) → 1000-1500
    expect(delays[0]).toBeGreaterThanOrEqual(1000)
    expect(delays[0]).toBeLessThanOrEqual(1500)

    // Attempt 2: 1000 * 2^1 = 2000 + jitter(0-500) → 2000-2500
    expect(delays[1]).toBeGreaterThanOrEqual(2000)
    expect(delays[1]).toBeLessThanOrEqual(2500)

    // Attempt 3: 1000 * 2^2 = 4000 + jitter(0-500) → 4000-4500
    expect(delays[2]).toBeGreaterThanOrEqual(4000)
    expect(delays[2]).toBeLessThanOrEqual(4500)

    vi.restoreAllMocks()
  })

  it('adds jitter within expected range', async () => {
    const delays: number[] = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: (...args: unknown[]) => void, ms?: number) => {
      if (ms && ms > 0) delays.push(ms)
      cb()
      return 0 as unknown as ReturnType<typeof globalThis.setTimeout>
    })

    // Run multiple times to verify jitter produces variation
    for (let i = 0; i < 10; i++) {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('err'))
        .mockResolvedValueOnce('ok')
      await withRetry(fn, {maxAttempts: 3, baseDelayMs: 1000, source: 'test'})
    }

    // All delays should be in the range [1000, 1500] (base 1000 + jitter 0-500)
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(1000)
      expect(d).toBeLessThanOrEqual(1500)
    }

    vi.restoreAllMocks()
  })

  it('respects Retry-After header override', async () => {
    const delays: number[] = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: (...args: unknown[]) => void, ms?: number) => {
      if (ms && ms > 0) delays.push(ms)
      cb()
      return 0 as unknown as ReturnType<typeof globalThis.setTimeout>
    })

    const retryableError = Object.assign(new Error('rate limited'), {retryAfterMs: 5000})
    const fn = vi.fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce('ok')

    const result = await withRetry(fn, {maxAttempts: 3, baseDelayMs: 100, source: 'test'})

    expect(result).toBe('ok')
    expect(delays[0]).toBe(5000) // Uses retryAfterMs instead of calculated backoff
    vi.restoreAllMocks()
  })

  it('throws immediately on permanent error without retry', async () => {
    const permanentError = new MATError(
      'Invalid auth',
      'AUTH_FAILED',
      'Bad credentials',
      'Re-authenticate',
      'platform/reddit',
      'permanent',
    )

    const fn = vi.fn().mockRejectedValue(permanentError)

    await expect(withRetry(fn, {maxAttempts: 5, baseDelayMs: 1000, source: 'test'}))
      .rejects
      .toThrow(RetryExhaustedError)

    expect(fn).toHaveBeenCalledTimes(1) // Only one attempt — no retries
  })

  it('throws RetryExhaustedError after max attempts', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: (...args: unknown[]) => void) => {
      cb()
      return 0 as unknown as ReturnType<typeof globalThis.setTimeout>
    })

    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    try {
      await withRetry(fn, {maxAttempts: 3, baseDelayMs: 100, source: 'test-source'})
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(RetryExhaustedError)
      const retryError = error as RetryExhaustedError
      expect(retryError.attempts).toBe(3)
      expect(retryError.elapsedMs).toBeGreaterThanOrEqual(0)
      expect(retryError.source).toBe('test-source')
      expect(retryError.lastError).toBeInstanceOf(Error)
      expect(retryError.code).toBe('RETRY_EXHAUSTED')
    }

    expect(fn).toHaveBeenCalledTimes(3)
    vi.restoreAllMocks()
  })

  it('supports custom isPermanent override', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom-permanent'))

    const options: RetryOptions = {
      maxAttempts: 5,
      baseDelayMs: 100,
      source: 'test',
      isPermanent: (err) => err instanceof Error && err.message === 'custom-permanent',
    }

    await expect(withRetry(fn, options)).rejects.toThrow(RetryExhaustedError)
    expect(fn).toHaveBeenCalledTimes(1) // Custom permanent stops immediately
  })

  it('RetryExhaustedError preserves permanent severity from lastError', async () => {
    const permanentError = new MATError(
      'Bad request',
      'INVALID_INPUT',
      'Invalid input',
      'Fix input',
      'api',
      'permanent',
    )
    const fn = vi.fn().mockRejectedValue(permanentError)

    try {
      await withRetry(fn, {maxAttempts: 3, baseDelayMs: 100, source: 'test'})
      expect.unreachable('should have thrown')
    } catch (error) {
      const retryErr = error as RetryExhaustedError
      expect(retryErr.severity).toBe('permanent')
    }
  })
})

describe('isPermanentError', () => {
  it('classifies MATError with permanent severity', () => {
    const err = new MATError('msg', 'CODE', 'reason', 'res', 'src', 'permanent')
    expect(isPermanentError(err)).toBe(true)
  })

  it('classifies MATError with transient severity', () => {
    const err = new MATError('msg', 'CODE', 'reason', 'res', 'src', 'transient')
    expect(isPermanentError(err)).toBe(false)
  })

  it('classifies 429 as transient', () => {
    expect(isPermanentError({statusCode: 429})).toBe(false)
  })

  it('classifies 400 as permanent', () => {
    expect(isPermanentError({statusCode: 400})).toBe(true)
  })

  it('classifies 401 as permanent', () => {
    expect(isPermanentError({statusCode: 401})).toBe(true)
  })

  it('classifies 403 as permanent', () => {
    expect(isPermanentError({statusCode: 403})).toBe(true)
  })

  it('classifies 500 as transient (not in 4xx range)', () => {
    expect(isPermanentError({statusCode: 500})).toBe(false)
  })

  it('classifies unknown errors as transient', () => {
    expect(isPermanentError(new Error('unknown'))).toBe(false)
  })

  it('classifies non-object errors as transient', () => {
    expect(isPermanentError('string error')).toBe(false)
    expect(isPermanentError(null)).toBe(false)
  })

  it('uses status field as fallback', () => {
    expect(isPermanentError({status: 403})).toBe(true)
  })
})

describe('extractRetryAfter', () => {
  it('extracts retryAfterMs as number', () => {
    expect(extractRetryAfter({retryAfterMs: 3000})).toBe(3000)
  })

  it('extracts retryAfter as number', () => {
    expect(extractRetryAfter({retryAfter: 5000})).toBe(5000)
  })

  it('extracts retryAfter as seconds string', () => {
    expect(extractRetryAfter({retryAfter: '10'})).toBe(10000)
  })

  it('returns undefined for missing retryAfter', () => {
    expect(extractRetryAfter({})).toBeUndefined()
    expect(extractRetryAfter(new Error('no retry'))).toBeUndefined()
  })

  it('returns undefined for null/non-object', () => {
    expect(extractRetryAfter(null)).toBeUndefined()
    expect(extractRetryAfter(undefined)).toBeUndefined()
  })

  it('returns undefined for zero or negative values', () => {
    expect(extractRetryAfter({retryAfterMs: 0})).toBeUndefined()
    expect(extractRetryAfter({retryAfterMs: -1})).toBeUndefined()
  })
})

describe('preset configs', () => {
  it('RETRY_PLATFORM_API has correct defaults', () => {
    expect(RETRY_PLATFORM_API).toEqual({
      maxAttempts: 5,
      baseDelayMs: 2000,
      source: 'platform-api',
    })
  })

  it('RETRY_AI_PROVIDER has correct defaults', () => {
    expect(RETRY_AI_PROVIDER).toEqual({
      maxAttempts: 3,
      baseDelayMs: 1000,
      source: 'ai-provider',
    })
  })
})
