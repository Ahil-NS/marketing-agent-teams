import {describe, it, expect} from 'vitest'

import {validateContentForPlatform, PLATFORM_CONSTRAINTS} from '../../../src/lib/platforms/content-validator.js'
import type {PlatformContent, PlatformName} from '../../../src/lib/platforms/types.js'

function makeContent(overrides: Partial<PlatformContent> & {platform: PlatformName}): PlatformContent {
  return {
    itemId: 'test-item-1',
    content: {
      body: 'Test content body',
      platformMeta: {},
    },
    ...overrides,
  }
}

describe('PLATFORM_CONSTRAINTS', () => {
  it('defines constraints for all four platforms', () => {
    expect(PLATFORM_CONSTRAINTS).toHaveProperty('reddit')
    expect(PLATFORM_CONSTRAINTS).toHaveProperty('tiktok')
    expect(PLATFORM_CONSTRAINTS).toHaveProperty('facebook')
    expect(PLATFORM_CONSTRAINTS).toHaveProperty('instagram')
  })

  it('reddit requires title and subreddit', () => {
    expect(PLATFORM_CONSTRAINTS.reddit.requiresTitle).toBe(true)
    expect(PLATFORM_CONSTRAINTS.reddit.requiresSubreddit).toBe(true)
  })

  it('tiktok and instagram require media', () => {
    expect(PLATFORM_CONSTRAINTS.tiktok.requiresMedia).toBe(true)
    expect(PLATFORM_CONSTRAINTS.instagram.requiresMedia).toBe(true)
  })

  it('tiktok has 30 hashtag max', () => {
    expect(PLATFORM_CONSTRAINTS.tiktok.hashtagMaxCount).toBe(30)
  })

  it('facebook has null hashtag limit', () => {
    expect(PLATFORM_CONSTRAINTS.facebook.hashtagMaxCount).toBeNull()
  })
})

describe('validateContentForPlatform', () => {
  describe('Reddit validation', () => {
    it('validates valid Reddit content', () => {
      const content = makeContent({
        platform: 'reddit',
        content: {
          title: 'My Post',
          body: 'Post body',
          platformMeta: {subreddit: 'r/test'},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('requires title for Reddit', () => {
      const content = makeContent({
        platform: 'reddit',
        content: {body: 'No title', platformMeta: {subreddit: 'r/test'}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'title' && e.constraint === 'required')).toBe(true)
    })

    it('requires subreddit for Reddit', () => {
      const content = makeContent({
        platform: 'reddit',
        content: {title: 'Title', body: 'Body', platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'platformMeta.subreddit')).toBe(true)
    })

    it('enforces body max length for Reddit', () => {
      const content = makeContent({
        platform: 'reddit',
        content: {
          title: 'Title',
          body: 'x'.repeat(40_001),
          platformMeta: {subreddit: 'r/test'},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'body' && e.constraint === 'maxLength')).toBe(true)
    })

    it('enforces title max length for Reddit', () => {
      const content = makeContent({
        platform: 'reddit',
        content: {
          title: 'T'.repeat(301),
          body: 'Body',
          platformMeta: {subreddit: 'r/test'},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'title' && e.constraint === 'maxLength')).toBe(true)
    })
  })

  describe('TikTok validation', () => {
    it('requires media for TikTok', () => {
      const content = makeContent({
        platform: 'tiktok',
        content: {body: 'Check this out', platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media' && e.constraint === 'required')).toBe(true)
    })

    it('validates valid TikTok content', () => {
      const content = makeContent({
        platform: 'tiktok',
        content: {
          body: 'Short caption',
          media: [{type: 'video', url: 'https://example.com/video.mp4'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(true)
    })

    it('enforces caption max length for TikTok', () => {
      const content = makeContent({
        platform: 'tiktok',
        content: {
          body: 'x'.repeat(301),
          media: [{type: 'video'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.constraint === 'maxLength')).toBe(true)
    })

    it('enforces hashtag max count for TikTok', () => {
      const content = makeContent({
        platform: 'tiktok',
        content: {
          body: 'Caption',
          hashtags: Array.from({length: 31}, (_, i) => `#tag${i}`),
          media: [{type: 'video'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'hashtags' && e.constraint === 'maxCount')).toBe(true)
    })
  })

  describe('Instagram validation', () => {
    it('requires media for Instagram', () => {
      const content = makeContent({
        platform: 'instagram',
        content: {body: 'Nice pic', platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'media')).toBe(true)
    })

    it('validates valid Instagram content', () => {
      const content = makeContent({
        platform: 'instagram',
        content: {
          body: 'Great sunset #photography',
          media: [{type: 'image', url: 'https://example.com/img.jpg', altText: 'Sunset'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(true)
    })

    it('enforces caption max length for Instagram', () => {
      const content = makeContent({
        platform: 'instagram',
        content: {
          body: 'x'.repeat(2201),
          media: [{type: 'image'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
    })

    it('enforces hashtag limit for Instagram', () => {
      const content = makeContent({
        platform: 'instagram',
        content: {
          body: 'Post',
          hashtags: Array.from({length: 31}, (_, i) => `#tag${i}`),
          media: [{type: 'image'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'hashtags')).toBe(true)
    })
  })

  describe('Facebook validation', () => {
    it('validates valid Facebook content', () => {
      const content = makeContent({
        platform: 'facebook',
        content: {body: 'Hello world!', platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(true)
    })

    it('does not require media for Facebook', () => {
      const content = makeContent({
        platform: 'facebook',
        content: {body: 'Text-only post', platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(true)
    })

    it('does not enforce hashtag limit for Facebook (null max)', () => {
      const content = makeContent({
        platform: 'facebook',
        content: {
          body: 'Post',
          hashtags: Array.from({length: 100}, (_, i) => `#tag${i}`),
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(true)
    })

    it('enforces post max length for Facebook', () => {
      const content = makeContent({
        platform: 'facebook',
        content: {body: 'x'.repeat(63_207), platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.valid).toBe(false)
    })
  })

  describe('warnings', () => {
    it('warns on empty body', () => {
      const content = makeContent({
        platform: 'facebook',
        content: {body: '', platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.warnings.some((w) => w.field === 'body')).toBe(true)
    })
  })

  describe('return shape', () => {
    it('includes platform in result', () => {
      const content = makeContent({
        platform: 'instagram',
        content: {body: 'test', media: [{type: 'image'}], platformMeta: {}},
      })
      const result = validateContentForPlatform(content)
      expect(result.platform).toBe('instagram')
    })

    it('includes error details with value and limit', () => {
      const content = makeContent({
        platform: 'tiktok',
        content: {
          body: 'x'.repeat(301),
          media: [{type: 'video'}],
          platformMeta: {},
        },
      })
      const result = validateContentForPlatform(content)
      const lengthError = result.errors.find((e) => e.constraint === 'maxLength')
      expect(lengthError).toBeDefined()
      expect(lengthError!.value).toBe(301)
      expect(lengthError!.limit).toBe(300)
    })
  })
})
