import {describe, expect, it} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/types.js'

// Will import after implementation
import {
  renderPlatformPreview,
  renderRedditPreview,
  renderTikTokPreview,
  renderInstagramPreview,
  renderFacebookPreview,
} from '../../../src/lib/review-queue/platform-previews.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-2026-03-01-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {
      title: 'Test post',
      body: 'Test body content.',
      platformMeta: {},
    },
    qualityScore: 0.85,
    complianceFlags: [],
    contentType: 'standard',
    generatedBy: 'reddit-post-creator',
    generatedAt: '2026-03-01T10:00:00Z',
    editHistory: [],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

describe('renderPlatformPreview', () => {
  it('dispatches to renderRedditPreview for reddit items', () => {
    const item = makeItem({platform: 'reddit'})
    const result = renderPlatformPreview(item)
    expect(result).toContain('Reddit Preview')
  })

  it('dispatches to renderTikTokPreview for tiktok items', () => {
    const item = makeItem({platform: 'tiktok'})
    const result = renderPlatformPreview(item)
    expect(result).toContain('TikTok Preview')
  })

  it('dispatches to renderInstagramPreview for instagram items', () => {
    const item = makeItem({platform: 'instagram'})
    const result = renderPlatformPreview(item)
    expect(result).toContain('Instagram Preview')
  })

  it('dispatches to renderFacebookPreview for facebook items', () => {
    const item = makeItem({platform: 'facebook'})
    const result = renderPlatformPreview(item)
    expect(result).toContain('Facebook Preview')
  })
})

describe('renderRedditPreview', () => {
  it('renders title, body, subreddit, and flair', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        title: 'Why meditation apps fail most users',
        body: 'A deep dive into meditation app UX patterns.',
        platformMeta: {
          subreddit: 'r/meditation',
          flair: 'Discussion',
        },
      },
    })

    const result = renderRedditPreview(item)
    expect(result).toContain('Reddit Preview')
    expect(result).toContain('r/meditation')
    expect(result).toContain('Discussion')
    expect(result).toContain('Why meditation apps fail most users')
    expect(result).toContain('A deep dive into meditation app UX patterns.')
  })

  it('renders first comment when present', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        title: 'Test title',
        body: 'Test body',
        platformMeta: {
          subreddit: 'r/technology',
          firstComment: 'Great question! Here is my take...',
        },
      },
    })

    const result = renderRedditPreview(item)
    expect(result).toContain('First Comment')
    expect(result).toContain('Great question! Here is my take...')
  })

  it('omits first comment section when absent', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        title: 'Test title',
        body: 'Test body',
        platformMeta: {subreddit: 'r/technology'},
      },
    })

    const result = renderRedditPreview(item)
    expect(result).not.toContain('First Comment')
  })

  it('handles missing subreddit gracefully', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        title: 'No subreddit post',
        body: 'Body text here.',
        platformMeta: {},
      },
    })

    const result = renderRedditPreview(item)
    expect(result).toContain('Reddit Preview')
    expect(result).toContain('No subreddit post')
  })

  it('handles missing flair gracefully', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        title: 'Post without flair',
        body: 'Body text here.',
        platformMeta: {subreddit: 'r/test'},
      },
    })

    const result = renderRedditPreview(item)
    expect(result).toContain('r/test')
    expect(result).not.toContain('•')
  })

  it('handles missing title using body as fallback', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        body: 'Body only content.',
        platformMeta: {subreddit: 'r/test'},
      },
    })

    const result = renderRedditPreview(item)
    expect(result).toContain('Body only content.')
  })
})

describe('renderTikTokPreview', () => {
  it('renders caption with character count', () => {
    const caption = 'Stop scrolling and try this 5-minute hack'
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: caption,
        hashtags: ['#productivity', '#lifehack'],
        platformMeta: {},
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).toContain('TikTok Preview')
    expect(result).toContain(`${caption.length}/300`)
    expect(result).toContain(caption)
  })

  it('renders hashtag list', () => {
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: 'Test caption',
        hashtags: ['#productivity', '#lifehack', '#morning'],
        platformMeta: {},
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).toContain('#productivity')
    expect(result).toContain('#lifehack')
    expect(result).toContain('#morning')
  })

  it('renders video prompt when present', () => {
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: 'Test caption',
        platformMeta: {
          videoPrompt: 'Person at desk, morning light, showing phone',
        },
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).toContain('Video Prompt')
    expect(result).toContain('Person at desk, morning light, showing phone')
  })

  it('renders SEO layers when present', () => {
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: 'Test caption',
        platformMeta: {
          seoLayers: {
            caption: ['productivity', 'morning routine'],
            audio: 'trending sound #12345',
            textOverlay: 'Try this tomorrow',
            hashtag: ['#productivity (2.1B views)'],
          },
        },
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).toContain('SEO Layers')
    expect(result).toContain('productivity, morning routine')
    expect(result).toContain('trending sound #12345')
    expect(result).toContain('Try this tomorrow')
    expect(result).toContain('#productivity (2.1B views)')
  })

  it('omits video prompt section when absent', () => {
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: 'Test caption',
        platformMeta: {},
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).not.toContain('Video Prompt')
  })

  it('omits SEO layers section when absent', () => {
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: 'Test caption',
        platformMeta: {},
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).not.toContain('SEO Layers')
  })

  it('handles missing hashtags gracefully', () => {
    const item = makeItem({
      platform: 'tiktok',
      content: {
        body: 'Test caption',
        platformMeta: {},
      },
    })

    const result = renderTikTokPreview(item)
    expect(result).toContain('TikTok Preview')
    // Should not crash, just omit hashtags section
  })
})

describe('renderInstagramPreview', () => {
  it('renders caption with character count', () => {
    const caption = 'The morning routine that changed everything'
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: caption,
        hashtags: ['#wellness', '#morning'],
        platformMeta: {},
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).toContain('Instagram Preview')
    expect(result).toContain(`${caption.length}/2200`)
    expect(result).toContain(caption)
  })

  it('renders hashtags with count out of 30', () => {
    const hashtags = ['#wellness', '#morning', '#productivity']
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        hashtags,
        platformMeta: {},
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).toContain('3/30')
    expect(result).toContain('#wellness')
  })

  it('renders carousel slides when present', () => {
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        platformMeta: {
          carouselSlides: [
            {index: 1, description: 'Hook slide — "Did you know..."'},
            {index: 2, description: 'Value slide — "Here\'s the data..."'},
            {index: 3, description: 'CTA slide — "Save this for later"'},
          ],
        },
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).toContain('Carousel')
    expect(result).toContain('[1]')
    expect(result).toContain('Hook slide')
    expect(result).toContain('[2]')
    expect(result).toContain('[3]')
  })

  it('renders image prompt when present', () => {
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        platformMeta: {
          imagePrompt: 'Minimalist flat lay, morning items on marble',
          coverImagePrompt: 'Alarm clock on nightstand',
        },
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).toContain('Image Prompt')
    expect(result).toContain('Minimalist flat lay, morning items on marble')
  })

  it('falls back to coverImagePrompt when imagePrompt absent', () => {
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        platformMeta: {
          coverImagePrompt: 'Alarm clock on nightstand, soft morning light',
        },
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).toContain('Image Prompt')
    expect(result).toContain('Alarm clock on nightstand, soft morning light')
  })

  it('omits carousel section when absent', () => {
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        platformMeta: {},
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).not.toContain('Carousel')
  })

  it('omits image prompt section when absent', () => {
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        platformMeta: {},
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).not.toContain('Image Prompt')
  })

  it('handles numeric carouselSlides as count', () => {
    const item = makeItem({
      platform: 'instagram',
      content: {
        body: 'Test caption',
        platformMeta: {
          carouselSlides: 5,
        },
      },
    })

    const result = renderInstagramPreview(item)
    expect(result).toContain('Carousel')
    expect(result).toContain('5 slides')
  })
})

describe('renderFacebookPreview', () => {
  it('renders post text', () => {
    const body = 'We have been thinking about productivity wrong.'
    const item = makeItem({
      platform: 'facebook',
      content: {
        title: 'The Science Behind 5-Minute Breaks',
        body,
        hashtags: ['#productivity', '#worklife'],
        platformMeta: {},
      },
    })

    const result = renderFacebookPreview(item)
    expect(result).toContain('Facebook Preview')
    expect(result).toContain(body)
  })

  it('renders hashtags', () => {
    const item = makeItem({
      platform: 'facebook',
      content: {
        body: 'Test post',
        hashtags: ['#productivity', '#worklife'],
        platformMeta: {},
      },
    })

    const result = renderFacebookPreview(item)
    expect(result).toContain('#productivity')
    expect(result).toContain('#worklife')
  })

  it('renders engagement prompt when present', () => {
    const item = makeItem({
      platform: 'facebook',
      content: {
        body: 'Test post',
        platformMeta: {
          engagementPrompt: 'What is your morning productivity secret?',
        },
      },
    })

    const result = renderFacebookPreview(item)
    expect(result).toContain('Engagement Prompt')
    expect(result).toContain('What is your morning productivity secret?')
  })

  it('omits engagement prompt section when absent', () => {
    const item = makeItem({
      platform: 'facebook',
      content: {
        body: 'Test post',
        platformMeta: {},
      },
    })

    const result = renderFacebookPreview(item)
    expect(result).not.toContain('Engagement Prompt')
  })

  it('handles missing hashtags gracefully', () => {
    const item = makeItem({
      platform: 'facebook',
      content: {
        body: 'Test post',
        platformMeta: {},
      },
    })

    const result = renderFacebookPreview(item)
    expect(result).toContain('Facebook Preview')
    // Should not crash when no hashtags
  })

  it('handles missing title gracefully', () => {
    const item = makeItem({
      platform: 'facebook',
      content: {
        body: 'Post text only, no title.',
        platformMeta: {},
      },
    })

    const result = renderFacebookPreview(item)
    expect(result).toContain('Post text only, no title.')
  })
})

describe('edge cases', () => {
  it('handles completely empty platformMeta', () => {
    for (const platform of ['reddit', 'tiktok', 'instagram', 'facebook'] as const) {
      const item = makeItem({
        platform,
        content: {
          body: 'Minimal content',
          platformMeta: {},
        },
      })

      const result = renderPlatformPreview(item)
      expect(result).toBeTruthy()
    }
  })

  it('handles empty body gracefully', () => {
    const item = makeItem({
      platform: 'reddit',
      content: {
        title: 'Title only',
        body: '',
        platformMeta: {},
      },
    })

    // Should not throw
    const result = renderPlatformPreview(item)
    expect(result).toContain('Reddit Preview')
  })

  it('handles very long content', () => {
    const longBody = 'A'.repeat(5000)
    const item = makeItem({
      platform: 'facebook',
      content: {
        body: longBody,
        platformMeta: {},
      },
    })

    const result = renderPlatformPreview(item)
    expect(result).toContain('Facebook Preview')
  })
})
