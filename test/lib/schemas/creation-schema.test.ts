import {describe, it, expect} from 'vitest'

import {
  redditContentPackageSchema,
  tiktokContentPackageSchema,
  facebookContentPackageSchema,
  instagramContentPackageSchema,
  contentItemSchema,
  creationInputsSchema,
  creationStageOutputSchema,
  hookWriterOutputSchema,
  hookWriterInputsSchema,
} from '../../../src/lib/schemas/creation-schema.js'

import validRedditContent from '../../fixtures/responses/claude-reddit-content.json'
import validTiktokContent from '../../fixtures/responses/claude-tiktok-content.json'
import validFacebookContent from '../../fixtures/responses/claude-facebook-content.json'
import validHookWriterOutput from '../../fixtures/responses/claude-hook-writer.json'
import validInstagramContent from '../../fixtures/responses/claude-instagram-content.json'
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
      facebookPackage: validFacebookContent,
      instagramPackage: validInstagramContent,
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
      hookWriterOutput: null,
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
        agentsSucceeded: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
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
      facebookPackage: validFacebookContent,
      instagramPackage: null,
      contentItems: [],
      hookWriterOutput: null,
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
        agentsSucceeded: ['tiktok-creator', 'facebook-creator'],
        agentsFailed: ['reddit-creator', 'instagram-creator'],
      },
    }
    const result = creationStageOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })

  it('validates output with both packages null', () => {
    const output = {
      redditPackage: null,
      tiktokPackage: null,
      facebookPackage: null,
      instagramPackage: null,
      contentItems: [],
      hookWriterOutput: null,
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
        agentsSucceeded: [],
        agentsFailed: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
      },
    }
    const result = creationStageOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
  })

  it('validates output with all four platforms', () => {
    const output = {
      redditPackage: validRedditContent,
      tiktokPackage: validTiktokContent,
      facebookPackage: validFacebookContent,
      instagramPackage: validInstagramContent,
      contentItems: [],
      hookWriterOutput: null,
      stageMetadata: {
        agentsExecuted: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
        agentsSucceeded: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator'],
        agentsFailed: [],
      },
    }
    const result = creationStageOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.redditPackage).not.toBeNull()
      expect(result.data.tiktokPackage).not.toBeNull()
      expect(result.data.facebookPackage).not.toBeNull()
      expect(result.data.instagramPackage).not.toBeNull()
    }
  })
})

describe('facebookContentPackageSchema', () => {
  it('validates correct structure', () => {
    const result = facebookContentPackageSchema.safeParse(validFacebookContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.posts).toHaveLength(2)
      expect(result.data.posts[0].postId).toBe('fb-post-001')
      expect(result.data.posts[0].format).toBe('text')
      expect(result.data.posts[0].engagementHook.length).toBeGreaterThan(0)
      expect(result.data.posts[0].targetGroups.length).toBeGreaterThanOrEqual(1)
      expect(result.data.stories).toHaveLength(1)
      expect(result.data.stories[0].frames.length).toBeGreaterThanOrEqual(1)
      expect(result.data.stories[0].interactions.length).toBeGreaterThanOrEqual(1)
      expect(result.data.variations.length).toBeGreaterThanOrEqual(1)
      expect(result.data.metadata.groupTargets.length).toBeGreaterThanOrEqual(1)
      expect(result.data.metadata.boostRecommendations.length).toBeGreaterThan(0)
      expect(result.data.metadata.crossPostStrategy.length).toBeGreaterThan(0)
      expect(result.data.generatedBy).toBe('facebook-creator')
      expect(result.data.campaignId).toBe('plan-2026-03-wellness-spring')
    }
  })

  it('rejects missing required fields (posts)', () => {
    const invalid = {...validFacebookContent, posts: undefined}
    const result = facebookContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields (metadata)', () => {
    const invalid = {...validFacebookContent, metadata: undefined}
    const result = facebookContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty posts array', () => {
    const invalid = {...validFacebookContent, posts: []}
    const result = facebookContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid post format', () => {
    const invalid = {
      ...validFacebookContent,
      posts: [{...validFacebookContent.posts[0], format: 'stories'}],
    }
    const result = facebookContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates group targeting in metadata', () => {
    const result = facebookContentPackageSchema.safeParse(validFacebookContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata.groupTargets).toContain('wellnesscommunity')
      expect(result.data.posts[0].targetGroups.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('instagramContentPackageSchema', () => {
  it('validates correct structure', () => {
    const result = instagramContentPackageSchema.safeParse(validInstagramContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.posts).toHaveLength(2)
      expect(result.data.posts[0].postId).toBe('ig-post-001')
      expect(result.data.posts[0].caption.length).toBeGreaterThan(0)
      expect(result.data.posts[0].hashtags.length).toBeGreaterThanOrEqual(1)
      expect(result.data.posts[0].format).toBe('carousel')
      expect(result.data.posts[0].artDirection.length).toBeGreaterThan(0)
      expect(result.data.reels).toHaveLength(1)
      expect(result.data.reels[0].hook.length).toBeGreaterThan(0)
      expect(result.data.reels[0].script.length).toBeGreaterThan(0)
      expect(result.data.reels[0].musicSuggestion.length).toBeGreaterThan(0)
      expect(result.data.stories).toHaveLength(1)
      expect(result.data.carousels).toHaveLength(1)
      expect(result.data.carousels[0].slides.length).toBeGreaterThanOrEqual(2)
      expect(result.data.imagePrompts).toHaveLength(2)
      expect(result.data.imagePrompts[0].promptText.length).toBeGreaterThanOrEqual(20)
      expect(result.data.imagePrompts[0].style).toBe('photography')
      expect(result.data.imagePrompts[0].aspectRatio).toBe('4:5')
      expect(result.data.imagePrompts[0].generator).toBe('flux')
      expect(result.data.variations.length).toBeGreaterThanOrEqual(1)
      expect(result.data.metadata.hashtagStrategy.length).toBeGreaterThan(0)
      expect(result.data.metadata.aestheticNotes.length).toBeGreaterThan(0)
      expect(result.data.generatedBy).toBe('instagram-creator')
      expect(result.data.campaignId).toBe('plan-2026-03-wellness-spring')
    }
  })

  it('rejects missing required fields (posts)', () => {
    const invalid = {...validInstagramContent, posts: undefined}
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields (metadata)', () => {
    const invalid = {...validInstagramContent, metadata: undefined}
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty posts array', () => {
    const invalid = {...validInstagramContent, posts: []}
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid post format', () => {
    const invalid = {
      ...validInstagramContent,
      posts: [{...validInstagramContent.posts[0], format: 'video'}],
    }
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid image prompt style', () => {
    const invalid = {
      ...validInstagramContent,
      imagePrompts: [{...validInstagramContent.imagePrompts[0], style: 'abstract'}],
    }
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid image prompt aspect ratio', () => {
    const invalid = {
      ...validInstagramContent,
      imagePrompts: [{...validInstagramContent.imagePrompts[0], aspectRatio: '16:9'}],
    }
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid image prompt generator', () => {
    const invalid = {
      ...validInstagramContent,
      imagePrompts: [{...validInstagramContent.imagePrompts[0], generator: 'dalle'}],
    }
    const result = instagramContentPackageSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('includes Reels scripts and image prompts', () => {
    const result = instagramContentPackageSchema.safeParse(validInstagramContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reels[0].hook).toBeTruthy()
      expect(result.data.reels[0].script).toBeTruthy()
      expect(result.data.reels[0].duration).toBeGreaterThan(0)
      expect(result.data.imagePrompts[0].promptText.length).toBeGreaterThanOrEqual(20)
      expect(result.data.imagePrompts[0].generator).toBeTruthy()
    }
  })
})

describe('hookWriterOutputSchema', () => {
  it('validates correct structure', () => {
    const result = hookWriterOutputSchema.safeParse(validHookWriterOutput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hooks.length).toBeGreaterThanOrEqual(1)
      expect(result.data.topPicks.length).toBeGreaterThanOrEqual(1)
      expect(result.data.abPairs.length).toBeGreaterThanOrEqual(1)
      expect(result.data.analysis).toBeDefined()
    }
  })

  it('validates hook fields: hookId, platform, triggerType, hookArchetype, confidenceScore', () => {
    const result = hookWriterOutputSchema.safeParse(validHookWriterOutput)
    expect(result.success).toBe(true)
    if (result.success) {
      const hook = result.data.hooks[0]
      expect(hook.hookId).toBeDefined()
      expect(['reddit', 'tiktok', 'facebook', 'instagram']).toContain(hook.platform)
      expect(hook.triggerType).toBeDefined()
      expect(hook.hookArchetype).toBeDefined()
      expect(hook.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(hook.confidenceScore).toBeLessThanOrEqual(1)
      expect(hook.characterCount).toBeGreaterThanOrEqual(1)
      expect(hook.hookText.length).toBeGreaterThanOrEqual(1)
      expect(hook.contentItemId).toBeDefined()
    }
  })

  it('validates A/B pair fields: hookA, hookB, variationStrategy, rationale', () => {
    const result = hookWriterOutputSchema.safeParse(validHookWriterOutput)
    expect(result.success).toBe(true)
    if (result.success) {
      const pair = result.data.abPairs[0]
      expect(pair.pairId).toBeDefined()
      expect(pair.contentItemId).toBeDefined()
      expect(pair.platform).toBeDefined()
      expect(pair.hookA).toBeDefined()
      expect(pair.hookB).toBeDefined()
      expect(pair.variationStrategy).toBeDefined()
      expect(pair.rationale.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('validates topPick fields: contentItemId, platform, recommendedHookId, rationale', () => {
    const result = hookWriterOutputSchema.safeParse(validHookWriterOutput)
    expect(result.success).toBe(true)
    if (result.success) {
      const pick = result.data.topPicks[0]
      expect(pick.contentItemId).toBeDefined()
      expect(pick.platform).toBeDefined()
      expect(pick.recommendedHookId).toBeDefined()
      expect(pick.rationale.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('rejects missing hooks array', () => {
    const invalid = {...validHookWriterOutput, hooks: undefined}
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty hooks array', () => {
    const invalid = {...validHookWriterOutput, hooks: []}
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing topPicks array', () => {
    const invalid = {...validHookWriterOutput, topPicks: undefined}
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing abPairs array', () => {
    const invalid = {...validHookWriterOutput, abPairs: undefined}
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects confidence score above 1', () => {
    const invalid = {
      ...validHookWriterOutput,
      hooks: [{
        ...validHookWriterOutput.hooks[0],
        confidenceScore: 1.5,
      }],
    }
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects confidence score below 0', () => {
    const invalid = {
      ...validHookWriterOutput,
      hooks: [{
        ...validHookWriterOutput.hooks[0],
        confidenceScore: -0.1,
      }],
    }
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid platform value', () => {
    const invalid = {
      ...validHookWriterOutput,
      hooks: [{
        ...validHookWriterOutput.hooks[0],
        platform: 'linkedin',
      }],
    }
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid trigger type', () => {
    const invalid = {
      ...validHookWriterOutput,
      hooks: [{
        ...validHookWriterOutput.hooks[0],
        triggerType: 'invalid-trigger',
      }],
    }
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid hook archetype', () => {
    const invalid = {
      ...validHookWriterOutput,
      hooks: [{
        ...validHookWriterOutput.hooks[0],
        hookArchetype: 'invalid-archetype',
      }],
    }
    const result = hookWriterOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('hookWriterInputsSchema', () => {
  it('validates correct inputs', () => {
    const inputs = {
      contentItems: [
        {
          itemId: 'post-001',
          platform: 'reddit',
          contentType: 'post',
          title: 'Test Post',
          body: 'Body content',
          agentName: 'reddit-creator',
          generatedBy: 'reddit-creator',
          campaignId: 'plan-2026-03-wellness-spring',
          status: 'draft',
          metadata: {},
          createdAt: '2026-03-15T10:00:00Z',
        },
      ],
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
        brandPrinciples: ['authenticity'],
        bannedPhrases: ['guaranteed results'],
        productName: 'TestApp',
      },
      campaignPlan: validCampaignPlan,
    }
    const result = hookWriterInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('rejects empty contentItems array', () => {
    const inputs = {
      contentItems: [],
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
        brandPrinciples: ['authenticity'],
        bannedPhrases: ['guaranteed results'],
        productName: 'TestApp',
      },
      campaignPlan: validCampaignPlan,
    }
    const result = hookWriterInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects missing brandVoiceConfig', () => {
    const inputs = {
      contentItems: [
        {
          itemId: 'post-001',
          platform: 'reddit',
          contentType: 'post',
          title: 'Test Post',
          body: 'Body content',
          agentName: 'reddit-creator',
          generatedBy: 'reddit-creator',
          campaignId: 'plan-001',
          status: 'draft',
          metadata: {},
          createdAt: '2026-03-15T10:00:00Z',
        },
      ],
      campaignPlan: validCampaignPlan,
    }
    const result = hookWriterInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})
