import {describe, expect, it} from 'vitest'

import {classifyError, classifyNetworkError} from '../../../src/lib/platforms/error-classifier.js'
import type {PlatformName} from '../../../src/lib/platforms/types.js'

describe('classifyError', () => {
  describe('HTTP status code classification', () => {
    const platforms: PlatformName[] = ['reddit', 'tiktok', 'facebook', 'instagram']

    for (const platform of platforms) {
      it(`classifies 429 as transient for ${platform}`, () => {
        const result = classifyError(platform, 429)
        expect(result.classification).toBe('transient')
        expect(result.retryable).toBe(true)
      })

      it(`classifies 500 as transient for ${platform}`, () => {
        const result = classifyError(platform, 500)
        expect(result.classification).toBe('transient')
        expect(result.retryable).toBe(true)
      })

      it(`classifies 502 as transient for ${platform}`, () => {
        const result = classifyError(platform, 502)
        expect(result.classification).toBe('transient')
        expect(result.retryable).toBe(true)
      })

      it(`classifies 503 as transient for ${platform}`, () => {
        const result = classifyError(platform, 503)
        expect(result.classification).toBe('transient')
        expect(result.retryable).toBe(true)
      })

      it(`classifies 401 as permanent for ${platform}`, () => {
        const result = classifyError(platform, 401)
        expect(result.classification).toBe('permanent')
        expect(result.retryable).toBe(false)
      })

      it(`classifies 403 as permanent for ${platform}`, () => {
        const result = classifyError(platform, 403)
        expect(result.classification).toBe('permanent')
        expect(result.retryable).toBe(false)
      })

      it(`classifies 400 as permanent for ${platform}`, () => {
        const result = classifyError(platform, 400)
        expect(result.classification).toBe('permanent')
        expect(result.retryable).toBe(false)
      })

      it(`classifies 404 as permanent for ${platform}`, () => {
        const result = classifyError(platform, 404)
        expect(result.classification).toBe('permanent')
        expect(result.retryable).toBe(false)
      })
    }
  })

  describe('Reddit platform-specific error codes', () => {
    it('classifies RATELIMIT as transient (overrides 400 status)', () => {
      const result = classifyError('reddit', 400, '{"error": "RATELIMIT", "message": "you are doing that too much"}')
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.resolution).toContain('Reddit')
      expect(result.resolution).toContain('cooldown')
    })

    it('classifies SUBMIT_VALIDATION as permanent', () => {
      const result = classifyError('reddit', 400, '{"error": "SUBMIT_VALIDATION_TITLE_TOO_LONG"}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('classifies SUBREDDIT_NOTALLOWED as permanent', () => {
      const result = classifyError('reddit', 403, '{"error": "SUBREDDIT_NOTALLOWED"}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
      expect(result.resolution).toContain('Reddit')
    })

    it('classifies USER_REQUIRED as permanent', () => {
      const result = classifyError('reddit', 401, '{"error": "USER_REQUIRED"}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('classifies BANNED_FROM_SUBREDDIT as permanent', () => {
      const result = classifyError('reddit', 403, '{"error": "BANNED_FROM_SUBREDDIT"}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })
  })

  describe('TikTok platform-specific error codes', () => {
    it('classifies spam_risk_too_many_posts as transient', () => {
      const result = classifyError('tiktok', 429, {error: {code: 'spam_risk_too_many_posts'}})
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.resolution).toContain('TikTok')
    })

    it('classifies token_expired as permanent', () => {
      const result = classifyError('tiktok', 401, {error: {code: 'token_expired'}})
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('classifies invalid_access_token as permanent', () => {
      const result = classifyError('tiktok', 401, {error: {code: 'invalid_access_token'}})
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('classifies rate_limit_exceeded as transient', () => {
      const result = classifyError('tiktok', 429, {error: {code: 'rate_limit_exceeded'}})
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
    })
  })

  describe('Facebook platform-specific error codes', () => {
    it('classifies (#4) rate limit as transient', () => {
      const result = classifyError('facebook', 400, '{"error": {"message": "(#4) Application request limit reached", "code": 4}}')
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.resolution).toContain('Facebook')
    })

    it('classifies (#200) permissions as permanent', () => {
      const result = classifyError('facebook', 403, '{"error": {"message": "(#200) Requires extended permission", "code": 200}}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
      expect(result.resolution).toContain('Facebook')
    })

    it('classifies (#190) token as permanent', () => {
      const result = classifyError('facebook', 401, '{"error": {"message": "(#190) Invalid OAuth access token", "code": 190}}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('classifies (#1) unknown as transient', () => {
      const result = classifyError('facebook', 500, '{"error": {"message": "(#1) An unknown error occurred", "code": 1}}')
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('classifies (#2) service unavailable as transient', () => {
      const result = classifyError('facebook', 503, '{"error": {"message": "(#2) Service temporarily unavailable", "code": 2}}')
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
    })

    it('classifies (#368) security policy as permanent', () => {
      const result = classifyError('facebook', 400, '{"error": {"message": "(#368) Content blocked", "code": 368}}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })
  })

  describe('Instagram platform-specific error codes', () => {
    it('classifies (#9) too many calls as transient', () => {
      const result = classifyError('instagram', 429, '{"error": {"message": "(#9) Too many calls to IG", "code": 9}}')
      expect(result.classification).toBe('transient')
      expect(result.retryable).toBe(true)
      expect(result.resolution).toContain('Instagram')
    })

    it('classifies (#10) API permission as permanent', () => {
      const result = classifyError('instagram', 403, '{"error": {"message": "(#10) API permission denied", "code": 10}}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
      expect(result.resolution).toContain('Instagram')
    })

    it('classifies (#100) invalid parameter as permanent', () => {
      const result = classifyError('instagram', 400, '{"error": {"message": "(#100) Invalid parameter", "code": 100}}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })

    it('classifies (#190) token as permanent', () => {
      const result = classifyError('instagram', 401, '{"error": {"message": "(#190) Invalid OAuth access token", "code": 190}}')
      expect(result.classification).toBe('permanent')
      expect(result.retryable).toBe(false)
    })
  })

  describe('error body as object', () => {
    it('handles error body passed as object', () => {
      const result = classifyError('reddit', 400, {error: 'RATELIMIT', message: 'too fast'})
      expect(result.classification).toBe('transient')
    })
  })

  describe('resolution text quality', () => {
    it('includes platform name in resolution for HTTP errors', () => {
      const result = classifyError('reddit', 500)
      expect(result.resolution).toContain('reddit')
    })

    it('includes platform name in resolution for platform-specific errors', () => {
      const result = classifyError('tiktok', 401, {error: {code: 'token_expired'}})
      expect(result.resolution).toContain('TikTok')
    })

    it('resolution is actionable and non-empty', () => {
      const result = classifyError('facebook', 400)
      expect(result.resolution.length).toBeGreaterThan(10)
    })
  })

  describe('falls back to HTTP status when body has no match', () => {
    it('uses HTTP status for unrecognized error body', () => {
      const result = classifyError('reddit', 500, '{"error": "UNKNOWN_CODE"}')
      expect(result.classification).toBe('transient') // Falls back to 500 → transient
    })
  })
})

describe('classifyNetworkError', () => {
  it('classifies timeout errors as transient', () => {
    const result = classifyNetworkError('reddit', 'Request timed out after 30000ms')
    expect(result.classification).toBe('transient')
    expect(result.retryable).toBe(true)
    expect(result.resolution).toContain('reddit')
  })

  it('classifies DNS errors as transient', () => {
    const result = classifyNetworkError('facebook', 'getaddrinfo ENOTFOUND graph.facebook.com')
    expect(result.classification).toBe('transient')
    expect(result.retryable).toBe(true)
    expect(result.resolution).toContain('facebook')
  })

  it('classifies ECONNREFUSED as transient', () => {
    const result = classifyNetworkError('tiktok', 'connect ECONNREFUSED 127.0.0.1:443')
    expect(result.classification).toBe('transient')
    expect(result.retryable).toBe(true)
  })

  it('classifies ECONNRESET as transient', () => {
    const result = classifyNetworkError('instagram', 'socket hang up ECONNRESET')
    expect(result.classification).toBe('transient')
    expect(result.retryable).toBe(true)
  })

  it('classifies generic network errors as transient', () => {
    const result = classifyNetworkError('reddit', 'network error occurred')
    expect(result.classification).toBe('transient')
    expect(result.retryable).toBe(true)
  })

  it('classifies unknown errors as transient', () => {
    const result = classifyNetworkError('facebook', 'some unknown failure')
    expect(result.classification).toBe('transient')
    expect(result.retryable).toBe(true)
  })
})
