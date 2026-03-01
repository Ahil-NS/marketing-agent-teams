import {describe, it, expect} from 'vitest'

import {
  platformNameSchema,
  authResultSchema,
  mediaAttachmentSchema,
  platformContentSchema,
  platformPublishErrorSchema,
  publishResultSchema,
  contentValidationErrorSchema,
  contentValidationWarningSchema,
  contentValidationResultSchema,
  rateLimitStatusSchema,
  platformMetricsSchema,
} from '../../../src/lib/schemas/platform-adapter-schema.js'

describe('platformNameSchema', () => {
  it('accepts valid platform names', () => {
    for (const name of ['reddit', 'tiktok', 'facebook', 'instagram']) {
      expect(platformNameSchema.parse(name)).toBe(name)
    }
  })

  it('rejects invalid platform names', () => {
    expect(() => platformNameSchema.parse('twitter')).toThrow()
    expect(() => platformNameSchema.parse('')).toThrow()
  })
})

describe('authResultSchema', () => {
  const validAuth = {
    success: true,
    platform: 'reddit' as const,
    scopes: ['read', 'write'],
    expiresAt: '2026-03-01T12:00:00Z',
  }

  it('accepts valid auth result', () => {
    expect(authResultSchema.parse(validAuth)).toMatchObject(validAuth)
  })

  it('accepts auth result without optional fields', () => {
    const minimal = {success: false, platform: 'tiktok', scopes: [], error: 'bad token'}
    expect(authResultSchema.parse(minimal)).toMatchObject(minimal)
  })

  it('rejects auth result without required fields', () => {
    expect(() => authResultSchema.parse({success: true})).toThrow()
  })
})

describe('mediaAttachmentSchema', () => {
  it('accepts valid media attachment', () => {
    const media = {type: 'image', url: 'https://example.com/img.jpg', altText: 'A picture'}
    expect(mediaAttachmentSchema.parse(media)).toMatchObject(media)
  })

  it('accepts minimal media attachment', () => {
    const media = {type: 'video'}
    expect(mediaAttachmentSchema.parse(media)).toMatchObject(media)
  })

  it('rejects invalid media type', () => {
    expect(() => mediaAttachmentSchema.parse({type: 'audio'})).toThrow()
  })
})

describe('platformContentSchema', () => {
  const validContent = {
    itemId: 'item-1',
    platform: 'reddit' as const,
    content: {
      title: 'Test Post',
      body: 'This is a test post body',
      hashtags: ['#test'],
      platformMeta: {subreddit: 'r/test'},
    },
  }

  it('accepts valid platform content', () => {
    expect(platformContentSchema.parse(validContent)).toMatchObject(validContent)
  })

  it('accepts content without optional fields', () => {
    const minimal = {
      itemId: 'item-2',
      platform: 'facebook',
      content: {body: 'Hello', platformMeta: {}},
    }
    expect(platformContentSchema.parse(minimal)).toMatchObject(minimal)
  })

  it('rejects content with empty itemId', () => {
    expect(() => platformContentSchema.parse({...validContent, itemId: ''})).toThrow()
  })

  it('accepts content with scheduled time', () => {
    const scheduled = {...validContent, scheduledTime: '2026-03-01T12:00:00Z'}
    expect(platformContentSchema.parse(scheduled)).toMatchObject(scheduled)
  })

  it('rejects invalid scheduled time format', () => {
    expect(() => platformContentSchema.parse({...validContent, scheduledTime: 'not-a-date'})).toThrow()
  })
})

describe('platformPublishErrorSchema', () => {
  it('accepts valid publish error', () => {
    const error = {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      classification: 'transient' as const,
      retryable: true,
      retryAfterMs: 5000,
    }
    expect(platformPublishErrorSchema.parse(error)).toMatchObject(error)
  })

  it('accepts error without retryAfterMs', () => {
    const error = {
      code: 'BANNED',
      message: 'Account suspended',
      classification: 'permanent' as const,
      retryable: false,
    }
    expect(platformPublishErrorSchema.parse(error)).toMatchObject(error)
  })

  it('rejects invalid classification', () => {
    expect(() =>
      platformPublishErrorSchema.parse({
        code: 'ERR',
        message: 'fail',
        classification: 'unknown',
        retryable: true,
      }),
    ).toThrow()
  })
})

describe('publishResultSchema', () => {
  it('accepts successful publish result', () => {
    const result = {
      success: true,
      platform: 'tiktok' as const,
      itemId: 'item-1',
      postId: 'tiktok-123',
      postUrl: 'https://tiktok.com/@user/video/123',
      publishedAt: '2026-03-01T12:00:00Z',
    }
    expect(publishResultSchema.parse(result)).toMatchObject(result)
  })

  it('accepts failed publish result with error', () => {
    const result = {
      success: false,
      platform: 'instagram' as const,
      itemId: 'item-2',
      error: {
        code: 'AUTH_EXPIRED',
        message: 'Token expired',
        classification: 'permanent' as const,
        retryable: false,
      },
    }
    expect(publishResultSchema.parse(result)).toMatchObject(result)
  })

  it('rejects missing itemId', () => {
    expect(() =>
      publishResultSchema.parse({success: true, platform: 'reddit'}),
    ).toThrow()
  })
})

describe('contentValidationErrorSchema', () => {
  it('accepts error with all fields', () => {
    const error = {
      field: 'body',
      constraint: 'maxLength',
      message: 'Body too long',
      value: 50_000,
      limit: 40_000,
    }
    expect(contentValidationErrorSchema.parse(error)).toMatchObject(error)
  })

  it('accepts error without optional fields', () => {
    const error = {field: 'title', constraint: 'required', message: 'Title required'}
    expect(contentValidationErrorSchema.parse(error)).toMatchObject(error)
  })
})

describe('contentValidationWarningSchema', () => {
  it('accepts valid warning', () => {
    const warning = {field: 'hashtags', message: 'Consider adding more hashtags'}
    expect(contentValidationWarningSchema.parse(warning)).toMatchObject(warning)
  })
})

describe('contentValidationResultSchema', () => {
  it('accepts valid result with errors', () => {
    const result = {
      valid: false,
      platform: 'reddit' as const,
      errors: [{field: 'title', constraint: 'required', message: 'Title is required'}],
      warnings: [],
    }
    expect(contentValidationResultSchema.parse(result)).toMatchObject(result)
  })

  it('accepts valid result with no issues', () => {
    const result = {
      valid: true,
      platform: 'facebook' as const,
      errors: [],
      warnings: [{field: 'body', message: 'Post is short'}],
    }
    expect(contentValidationResultSchema.parse(result)).toMatchObject(result)
  })
})

describe('rateLimitStatusSchema', () => {
  const validRateLimit = {
    platform: 'tiktok' as const,
    remaining: 5,
    limit: 15,
    resetsAt: '2026-03-01T13:00:00Z',
    windowType: 'day' as const,
  }

  it('accepts valid rate limit status', () => {
    expect(rateLimitStatusSchema.parse(validRateLimit)).toMatchObject(validRateLimit)
  })

  it('rejects negative remaining', () => {
    expect(() => rateLimitStatusSchema.parse({...validRateLimit, remaining: -1})).toThrow()
  })

  it('rejects invalid window type', () => {
    expect(() => rateLimitStatusSchema.parse({...validRateLimit, windowType: 'week'})).toThrow()
  })

  it('accepts zero remaining', () => {
    expect(rateLimitStatusSchema.parse({...validRateLimit, remaining: 0})).toMatchObject({
      ...validRateLimit,
      remaining: 0,
    })
  })
})

describe('platformMetricsSchema', () => {
  const validMetrics = {
    postId: 'post-abc',
    platform: 'instagram' as const,
    views: 1000,
    likes: 50,
    comments: 10,
    shares: 5,
    engagementRate: 0.065,
    retrievedAt: '2026-03-01T14:00:00Z',
  }

  it('accepts valid metrics', () => {
    expect(platformMetricsSchema.parse(validMetrics)).toMatchObject(validMetrics)
  })

  it('accepts metrics with only required fields', () => {
    const minimal = {
      postId: 'post-xyz',
      platform: 'facebook',
      retrievedAt: '2026-03-01T14:00:00Z',
    }
    expect(platformMetricsSchema.parse(minimal)).toMatchObject(minimal)
  })

  it('rejects engagement rate above 1', () => {
    expect(() => platformMetricsSchema.parse({...validMetrics, engagementRate: 1.5})).toThrow()
  })

  it('rejects negative likes', () => {
    expect(() => platformMetricsSchema.parse({...validMetrics, likes: -1})).toThrow()
  })
})
