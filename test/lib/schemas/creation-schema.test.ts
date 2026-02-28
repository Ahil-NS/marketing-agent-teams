import {describe, it, expect} from 'vitest'

import {
  redditContentPackageSchema,
  tiktokContentPackageSchema,
  contentItemSchema,
  creationInputsSchema,
  creationStageOutputSchema,
} from '../../../src/lib/schemas/creation-schema.js'

import validRedditContent from '../../fixtures/responses/claude-reddit-content.json'
import validTiktokContent from '../../fixtures/responses/claude-tiktok-content.json'
import validCampaignPlan from '../../fixtures/responses/claude-campaign-plan.json'
import validContentCalendar from '../../fixtures/responses/claude-content-calendar.json'
import validChannelOptimization from '../../fixtures/responses/claude-channel-optimization.json'

describe('redditContentPackageSchema', () => {
  it('validates correct structure', () => {
    const result = redditContentPackageSchema.safeParse(validRedditContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.posts).toHaveLength(2)
      expect(result.data.posts[0].postId).toBe('post-001')
      expect(result.data.posts[0].titleVariations.length).toBeGreaterThanOrEqual(1)
      expect(result.data.posts[0].firstComment.timing).toBe('within-30s')
      expect(result.data.comments.length).toBeGreaterThanOrEqual(1)
      expect(result.data.variations.length).toBeGreaterThanOrEqual(1)
      expect(result.data.metadata.targetSubreddits.length).toBeGreaterThanOrEqual(1)
      expect(result.data.generatedBy).toBe('reddit-creator')
      expect(result.data.campaignId).toBe('plan-2026-03-wellness-spring')
    }
  })

  it('rejects missing required fields (posts)', () => {
    const invalid = {...validRedditContent, posts: undefined}
    const result = redditContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields (metadata)', () => {
    const invalid = {...validRedditContent, metadata: undefined}
    const result = redditContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty posts array', () => {
    const invalid = {...validRedditContent, posts: []}
    const result = redditContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid post type', () => {
    const invalid = {
      ...validRedditContent,
      posts: [{...validRedditContent.posts[0], postType: 'video-reel'}],
    }
    const result = redditContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid first comment purpose', () => {
    const invalid = {
      ...validRedditContent,
      posts: [{
        ...validRedditContent.posts[0],
        firstComment: {...validRedditContent.posts[0].firstComment, purpose: 'spam'},
      }],
    }
    const result = redditContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('tiktokContentPackageSchema', () => {
  it('validates correct structure', () => {
    const result = tiktokContentPackageSchema.safeParse(validTiktokContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scripts).toHaveLength(2)
      expect(result.data.scripts[0].scriptId).toBe('script-001')
      expect(result.data.scripts[0].duration).toBe('30s')
      expect(result.data.scripts[0].onScreenText.length).toBeGreaterThanOrEqual(1)
      expect(result.data.captions).toHaveLength(2)
      expect(result.data.captions[0].hashtags.length).toBeGreaterThanOrEqual(1)
      expect(result.data.captions[0].keywords.length).toBeGreaterThanOrEqual(1)
      expect(result.data.videoPrompts).toHaveLength(2)
      expect(result.data.videoPrompts[0].veo3Prompt.length).toBeGreaterThanOrEqual(20)
      expect(result.data.variations.length).toBeGreaterThanOrEqual(1)
      expect(result.data.generatedBy).toBe('tiktok-creator')
      expect(result.data.campaignId).toBe('plan-2026-03-wellness-spring')
    }
  })

  it('rejects missing required fields (scripts)', () => {
    const invalid = {...validTiktokContent, scripts: undefined}
    const result = tiktokContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields (captions)', () => {
    const invalid = {...validTiktokContent, captions: undefined}
    const result = tiktokContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty scripts array', () => {
    const invalid = {...validTiktokContent, scripts: []}
    const result = tiktokContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid duration', () => {
    const invalid = {
      ...validTiktokContent,
      scripts: [{...validTiktokContent.scripts[0], duration: '45s'}],
    }
    const result = tiktokContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid video prompt style', () => {
    const invalid = {
      ...validTiktokContent,
      videoPrompts: [{...validTiktokContent.videoPrompts[0], style: 'abstract'}],
    }
    const result = tiktokContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('contentItemSchema', () => {
  it('validates correct structure', () => {
    const item = {
      itemId: 'post-001',
      platform: 'reddit',
      contentType: 'post',
      title: 'Test post title',
      body: 'Test post body content',
      metadata: {subreddit: 'selfimprovement', flair: 'Guide'},
      status: 'draft',
      generatedBy: 'reddit-creator',
      agentName: 'reddit-creator',
      campaignId: 'plan-2026-03-wellness-spring',
      createdAt: '2026-03-01T10:00:00Z',
    }
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('rejects invalid platform', () => {
    const item = {
      itemId: 'post-001',
      platform: 'linkedin',
      contentType: 'post',
      title: 'Test',
      body: 'Test body',
      metadata: {},
      status: 'draft',
      generatedBy: 'agent',
      agentName: 'agent',
      campaignId: 'plan-01',
      createdAt: '2026-03-01T10:00:00Z',
    }
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const item = {
      itemId: 'post-001',
      platform: 'reddit',
      contentType: 'post',
      title: 'Test',
      body: 'Test body',
      metadata: {},
      status: 'pending',
      generatedBy: 'agent',
      agentName: 'agent',
      campaignId: 'plan-01',
      createdAt: '2026-03-01T10:00:00Z',
    }
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })
})

describe('creationInputsSchema', () => {
  it('validates correct inputs', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      contentCalendar: validContentCalendar,
      channelOptimizationPlan: validChannelOptimization,
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear and direct',
        brandPrinciples: ['authenticity', 'empowerment'],
        bannedPhrases: ['guaranteed results'],
        productName: 'WellnessApp',
      },
      trendBrief: {
        trends: [{
          name: 'Short-form video',
          platform: 'tiktok',
          description: 'Trending format',
        }],
        recommendations: 'Focus on short-form content',
      },
    }
    const result = creationInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('rejects missing campaign plan', () => {
    const inputs = {
      contentCalendar: validContentCalendar,
      channelOptimizationPlan: validChannelOptimization,
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
        brandPrinciples: [],
        bannedPhrases: [],
      },
      trendBrief: {
        trends: [],
        recommendations: 'none',
      },
    }
    const result = creationInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})

describe('creationStageOutputSchema', () => {
  it('validates combined output with both packages', () => {
    const output = {
      redditPackage: validRedditContent,
      tiktokPackage: validTiktokContent,
      contentItems: [{
        itemId: 'post-001',
        platform: 'reddit',
        contentType: 'post',
        title: 'Test',
        body: 'Body text',
        metadata: {},
        status: 'draft',
        generatedBy: 'reddit-creator',
        agentName: 'reddit-creator',
        campaignId: 'plan-2026-03-wellness-spring',
        createdAt: '2026-03-01T10:00:00Z',
      }],
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator'],
        agentsSucceeded: ['reddit-creator', 'tiktok-creator'],
        agentsFailed: [],
      },
    }
    const result = creationStageOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })

  it('validates output with partial success (null reddit)', () => {
    const output = {
      redditPackage: null,
      tiktokPackage: validTiktokContent,
      contentItems: [],
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator'],
        agentsSucceeded: ['tiktok-creator'],
        agentsFailed: ['reddit-creator'],
      },
    }
    const result = creationStageOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })

  it('validates output with both packages null', () => {
    const output = {
      redditPackage: null,
      tiktokPackage: null,
      contentItems: [],
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator'],
        agentsSucceeded: [],
        agentsFailed: ['reddit-creator', 'tiktok-creator'],
      },
    }
    const result = creationStageOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })
})
