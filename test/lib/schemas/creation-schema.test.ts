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
  imagePromptSchema,
  videoPromptSchema,
  imageGeneratorEnum,
  videoGeneratorEnum,
  viralContentItemSchema,
  derivativeContentItemSchema,
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

  it('accepts optional verticalContext string', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      contentCalendar: validContentCalendar,
      channelOptimizationPlan: validChannelOptimization,
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear and direct',
        brandPrinciples: ['authenticity'],
        bannedPhrases: ['guaranteed'],
      },
      trendBrief: {
        trends: [],
        recommendations: 'none',
      },
      verticalContext: '# Wellness Hooks\n\nHook content here.',
    }
    const result = creationInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.verticalContext).toBe('# Wellness Hooks\n\nHook content here.')
    }
  })

  it('accepts undefined verticalContext (generic defaults)', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
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
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.verticalContext).toBeUndefined()
    }
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

  it('accepts optional verticalContext string', () => {
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
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
        brandPrinciples: ['authenticity'],
        bannedPhrases: ['guaranteed'],
      },
      campaignPlan: validCampaignPlan,
      verticalContext: '# Wellness Compliance\n\nNo medical claims in hooks.',
    }
    const result = hookWriterInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.verticalContext).toBe('# Wellness Compliance\n\nNo medical claims in hooks.')
    }
  })

  it('accepts undefined verticalContext (generic defaults)', () => {
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
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
        brandPrinciples: ['authenticity'],
        bannedPhrases: ['guaranteed'],
      },
      campaignPlan: validCampaignPlan,
    }
    const result = hookWriterInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.verticalContext).toBeUndefined()
    }
  })
})

describe('imagePromptSchema', () => {
  const validImagePrompt = {
    promptId: 'ig-img-001',
    contentItemId: 'ig-post-001',
    promptText: 'A person sitting cross-legged on a bed in warm morning light, writing in a journal',
    generator: 'flux',
    style: 'photography',
    aspectRatio: '4:5',
    brandElements: ['sage green palette', 'clean sans-serif typography'],
    visualConcept: 'Morning journaling lifestyle shot for habit-building campaign',
    estimatedQuality: 'high',
  }

  it('validates correct structure', () => {
    const result = imagePromptSchema.safeParse(validImagePrompt)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promptId).toBe('ig-img-001')
      expect(result.data.contentItemId).toBe('ig-post-001')
      expect(result.data.generator).toBe('flux')
      expect(result.data.style).toBe('photography')
      expect(result.data.aspectRatio).toBe('4:5')
      expect(result.data.brandElements).toHaveLength(2)
      expect(result.data.visualConcept).toBe('Morning journaling lifestyle shot for habit-building campaign')
      expect(result.data.estimatedQuality).toBe('high')
    }
  })

  it('validates all generator enum values (flux, ideogram, gpt-image)', () => {
    for (const generator of ['flux', 'ideogram', 'gpt-image']) {
      const result = imagePromptSchema.safeParse({...validImagePrompt, generator})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid generator value', () => {
    const result = imagePromptSchema.safeParse({...validImagePrompt, generator: 'dalle'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid generator value (midjourney)', () => {
    const result = imagePromptSchema.safeParse({...validImagePrompt, generator: 'midjourney'})
    expect(result.success).toBe(false)
  })

  it('validates all style enum values', () => {
    for (const style of ['photography', 'illustration', '3d-render', 'graphic-design']) {
      const result = imagePromptSchema.safeParse({...validImagePrompt, style})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid style value', () => {
    const result = imagePromptSchema.safeParse({...validImagePrompt, style: 'abstract'})
    expect(result.success).toBe(false)
  })

  it('validates all estimatedQuality enum values', () => {
    for (const estimatedQuality of ['high', 'medium', 'low']) {
      const result = imagePromptSchema.safeParse({...validImagePrompt, estimatedQuality})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid estimatedQuality value', () => {
    const result = imagePromptSchema.safeParse({...validImagePrompt, estimatedQuality: 'excellent'})
    expect(result.success).toBe(false)
  })

  it('rejects prompt text shorter than 20 characters', () => {
    const result = imagePromptSchema.safeParse({...validImagePrompt, promptText: 'Too short'})
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const {promptId, ...withoutPromptId} = validImagePrompt
    expect(imagePromptSchema.safeParse(withoutPromptId).success).toBe(false)

    const {contentItemId, ...withoutContentItemId} = validImagePrompt
    expect(imagePromptSchema.safeParse(withoutContentItemId).success).toBe(false)

    const {generator, ...withoutGenerator} = validImagePrompt
    expect(imagePromptSchema.safeParse(withoutGenerator).success).toBe(false)

    const {visualConcept, ...withoutVisualConcept} = validImagePrompt
    expect(imagePromptSchema.safeParse(withoutVisualConcept).success).toBe(false)
  })

  it('allows empty brandElements array', () => {
    const result = imagePromptSchema.safeParse({...validImagePrompt, brandElements: []})
    expect(result.success).toBe(true)
  })
})

describe('videoPromptSchema', () => {
  const validVideoPrompt = {
    promptId: 'tt-vid-001',
    contentItemId: 'script-001',
    promptText: 'A young professional sits on a bed in a bright modern bedroom with warm morning light',
    generator: 'veo3',
    sceneDescription: 'Bright modern bedroom, natural morning sunlight, warm amber tones',
    cameraMovement: 'tracking',
    transitions: ['cut', 'smooth zoom', 'text pop-in'],
    duration: '30s',
    audioMusic: 'Lo-fi hip hop background at low volume, subtle ambient sounds',
    visualStyle: 'lo-fi',
    brandElements: ['warm earth tones', 'clean typography'],
  }

  it('validates correct structure', () => {
    const result = videoPromptSchema.safeParse(validVideoPrompt)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promptId).toBe('tt-vid-001')
      expect(result.data.contentItemId).toBe('script-001')
      expect(result.data.generator).toBe('veo3')
      expect(result.data.sceneDescription).toContain('bedroom')
      expect(result.data.cameraMovement).toBe('tracking')
      expect(result.data.transitions).toHaveLength(3)
      expect(result.data.duration).toBe('30s')
      expect(result.data.audioMusic).toContain('Lo-fi')
      expect(result.data.visualStyle).toBe('lo-fi')
      expect(result.data.brandElements).toHaveLength(2)
    }
  })

  it('validates veo3 as the only generator', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, generator: 'veo3'})
    expect(result.success).toBe(true)
  })

  it('rejects invalid generator value', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, generator: 'sora'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid generator value (runway)', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, generator: 'runway'})
    expect(result.success).toBe(false)
  })

  it('validates all visualStyle enum values', () => {
    for (const visualStyle of ['cinematic', 'lo-fi', 'clean', 'vibrant', 'raw', 'editorial']) {
      const result = videoPromptSchema.safeParse({...validVideoPrompt, visualStyle})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid visualStyle value', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, visualStyle: 'abstract'})
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const {sceneDescription, ...withoutScene} = validVideoPrompt
    expect(videoPromptSchema.safeParse(withoutScene).success).toBe(false)

    const {cameraMovement, ...withoutCamera} = validVideoPrompt
    expect(videoPromptSchema.safeParse(withoutCamera).success).toBe(false)

    const {audioMusic, ...withoutAudio} = validVideoPrompt
    expect(videoPromptSchema.safeParse(withoutAudio).success).toBe(false)

    const {duration, ...withoutDuration} = validVideoPrompt
    expect(videoPromptSchema.safeParse(withoutDuration).success).toBe(false)
  })

  it('rejects prompt text shorter than 20 characters', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, promptText: 'Too short'})
    expect(result.success).toBe(false)
  })

  it('allows empty transitions array', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, transitions: []})
    expect(result.success).toBe(true)
  })

  it('allows empty brandElements array', () => {
    const result = videoPromptSchema.safeParse({...validVideoPrompt, brandElements: []})
    expect(result.success).toBe(true)
  })
})

describe('imageGeneratorEnum', () => {
  it('accepts flux, ideogram, gpt-image', () => {
    expect(imageGeneratorEnum.safeParse('flux').success).toBe(true)
    expect(imageGeneratorEnum.safeParse('ideogram').success).toBe(true)
    expect(imageGeneratorEnum.safeParse('gpt-image').success).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(imageGeneratorEnum.safeParse('dalle').success).toBe(false)
    expect(imageGeneratorEnum.safeParse('midjourney').success).toBe(false)
    expect(imageGeneratorEnum.safeParse('stable-diffusion').success).toBe(false)
  })
})

describe('videoGeneratorEnum', () => {
  it('accepts veo3', () => {
    expect(videoGeneratorEnum.safeParse('veo3').success).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(videoGeneratorEnum.safeParse('sora').success).toBe(false)
    expect(videoGeneratorEnum.safeParse('runway').success).toBe(false)
    expect(videoGeneratorEnum.safeParse('pika').success).toBe(false)
  })
})

describe('contentItemSchema with visual prompts', () => {
  const baseItem = {
    itemId: 'ig-post-001',
    platform: 'instagram',
    contentType: 'static',
    title: 'Test post',
    body: 'Test body content',
    metadata: {},
    status: 'draft',
    generatedBy: 'instagram-creator',
    agentName: 'instagram-creator',
    campaignId: 'plan-2026-03-wellness-spring',
    createdAt: '2026-03-01T10:00:00Z',
  }

  const sampleImagePrompt = {
    promptId: 'ig-img-001',
    contentItemId: 'ig-post-001',
    promptText: 'A person sitting cross-legged on a bed in warm morning light, writing in a journal',
    generator: 'flux',
    style: 'photography',
    aspectRatio: '4:5',
    brandElements: ['sage green'],
    visualConcept: 'Morning journaling lifestyle shot',
    estimatedQuality: 'high',
  }

  const sampleVideoPrompt = {
    promptId: 'ig-vid-001',
    contentItemId: 'ig-reel-001',
    promptText: 'A young professional sits on a bed in a bright modern bedroom with warm morning light',
    generator: 'veo3',
    sceneDescription: 'Bright modern bedroom, natural morning sunlight',
    cameraMovement: 'tracking',
    transitions: ['cut', 'smooth zoom'],
    duration: '30s',
    audioMusic: 'Lo-fi hip hop background at low volume',
    visualStyle: 'lo-fi',
    brandElements: ['warm earth tones'],
  }

  it('accepts contentItem without imagePrompts or videoPrompts (optional)', () => {
    const result = contentItemSchema.safeParse(baseItem)
    expect(result.success).toBe(true)
  })

  it('accepts contentItem with imagePrompts array', () => {
    const item = {...baseItem, imagePrompts: [sampleImagePrompt]}
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imagePrompts).toHaveLength(1)
      expect(result.data.imagePrompts![0].generator).toBe('flux')
    }
  })

  it('accepts contentItem with videoPrompts array', () => {
    const item = {...baseItem, videoPrompts: [sampleVideoPrompt]}
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.videoPrompts).toHaveLength(1)
      expect(result.data.videoPrompts![0].generator).toBe('veo3')
    }
  })

  it('accepts contentItem with both imagePrompts and videoPrompts', () => {
    const item = {...baseItem, imagePrompts: [sampleImagePrompt], videoPrompts: [sampleVideoPrompt]}
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imagePrompts).toHaveLength(1)
      expect(result.data.videoPrompts).toHaveLength(1)
    }
  })

  it('accepts contentItem with empty imagePrompts and videoPrompts arrays', () => {
    const item = {...baseItem, imagePrompts: [], videoPrompts: []}
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('rejects contentItem with invalid imagePrompt in array', () => {
    const invalidPrompt = {...sampleImagePrompt, generator: 'dalle'}
    const item = {...baseItem, imagePrompts: [invalidPrompt]}
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('rejects contentItem with invalid videoPrompt in array', () => {
    const invalidPrompt = {...sampleVideoPrompt, generator: 'sora'}
    const item = {...baseItem, videoPrompts: [invalidPrompt]}
    const result = contentItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })
})

describe('viralContentItemSchema', () => {
  const validViralItem = {
    originalItemId: 'item-001',
    platform: 'reddit',
    engagementMetrics: {
      itemId: 'item-001',
      platform: 'reddit',
      likes: 500,
      shares: 100,
      comments: 200,
      views: 10_000,
      engagementRate: 0.08,
    },
    thresholdExceeded: true,
    detectedAt: '2026-03-01T12:00:00Z',
  }

  it('validates correct structure', () => {
    const result = viralContentItemSchema.safeParse(validViralItem)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.originalItemId).toBe('item-001')
      expect(result.data.platform).toBe('reddit')
      expect(result.data.thresholdExceeded).toBe(true)
    }
  })

  it('rejects missing originalItemId', () => {
    const {originalItemId: _, ...invalid} = validViralItem
    const result = viralContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid platform', () => {
    const invalid = {...validViralItem, platform: 'myspace'}
    const result = viralContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates all four platforms', () => {
    for (const platform of ['reddit', 'tiktok', 'facebook', 'instagram']) {
      const item = {...validViralItem, platform}
      const result = viralContentItemSchema.safeParse(item)
      expect(result.success).toBe(true)
    }
  })

  it('rejects missing engagementMetrics', () => {
    const {engagementMetrics: _, ...invalid} = validViralItem
    const result = viralContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing detectedAt', () => {
    const {detectedAt: _, ...invalid} = validViralItem
    const result = viralContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('derivativeContentItemSchema', () => {
  const validDerivative = {
    itemId: 'deriv-001',
    platform: 'tiktok',
    contentType: 'video-script',
    title: 'Derivative hook',
    body: 'Derivative body content',
    metadata: {
      derivativeOf: 'item-001',
      sourcePlatform: 'reddit',
      tags: ['trending-derivative'],
      sourceEngagement: {engagementRate: 0.08},
    },
    status: 'draft',
    generatedBy: 'tiktok-creator',
    agentName: 'tiktok-creator',
    campaignId: 'campaign-001',
    createdAt: '2026-03-01T12:00:00Z',
    sourceItemId: 'item-001',
    derivativeType: 'cross-platform',
    variationStrategy: 'Different platform with adapted format',
  }

  it('validates correct derivative structure', () => {
    const result = derivativeContentItemSchema.safeParse(validDerivative)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sourceItemId).toBe('item-001')
      expect(result.data.derivativeType).toBe('cross-platform')
      expect(result.data.variationStrategy).toBe('Different platform with adapted format')
    }
  })

  it('extends ContentItem with derivative fields', () => {
    const result = derivativeContentItemSchema.safeParse(validDerivative)
    expect(result.success).toBe(true)
    if (result.success) {
      // ContentItem fields
      expect(result.data.itemId).toBe('deriv-001')
      expect(result.data.platform).toBe('tiktok')
      expect(result.data.status).toBe('draft')
      // Derivative-specific fields
      expect(result.data.sourceItemId).toBe('item-001')
      expect(result.data.derivativeType).toBe('cross-platform')
    }
  })

  it('validates all derivativeType values', () => {
    const types = ['hook-variation', 'cross-platform', 'format-change', 'audience-segment'] as const
    for (const type of types) {
      const item = {...validDerivative, derivativeType: type}
      const result = derivativeContentItemSchema.safeParse(item)
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid derivativeType', () => {
    const invalid = {...validDerivative, derivativeType: 'unknown'}
    const result = derivativeContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing sourceItemId', () => {
    const {sourceItemId: _, ...invalid} = validDerivative
    const result = derivativeContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing variationStrategy', () => {
    const {variationStrategy: _, ...invalid} = validDerivative
    const result = derivativeContentItemSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

