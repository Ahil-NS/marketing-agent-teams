import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {CreationInputs} from '../../../src/lib/schemas/creation-schema.js'

import validRedditContent from '../../fixtures/responses/claude-reddit-content.json'
import validTiktokContent from '../../fixtures/responses/claude-tiktok-content.json'
import validFacebookContent from '../../fixtures/responses/claude-facebook-content.json'
import validInstagramContent from '../../fixtures/responses/claude-instagram-content.json'
import validHookWriterOutput from '../../fixtures/responses/claude-hook-writer.json'
import validCampaignPlan from '../../fixtures/responses/claude-campaign-plan.json'
import validContentCalendar from '../../fixtures/responses/claude-content-calendar.json'
import validChannelOptimization from '../../fixtures/responses/claude-channel-optimization.json'

const creationInputs: CreationInputs = {
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

describe('runRedditCreator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid RedditContentPackage on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validRedditContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runRedditCreator(creationInputs)

    expect(result.agentName).toBe('reddit-creator')
    expect(result.status).toBe('success')
    expect(result.outputs.posts).toHaveLength(2)
    expect(result.outputs.posts[0].postId).toBe('post-001')
    expect(result.outputs.posts[0].titleVariations.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.posts[0].firstComment.timing).toBe('within-30s')
    expect(result.outputs.posts[0].engagementPlan.responseTemplates.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.comments.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.variations.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.metadata.targetSubreddits.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.generatedBy).toBe('reddit-creator')
    expect(result.outputs.campaignId).toBe('plan-2026-03-wellness-spring')
  })

  it('throws AgentTimeoutError on error_max_turns', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_turns')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentTimeoutError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runRedditCreator(creationInputs)).rejects.toThrow(AgentTimeoutError)
  })

  it('throws AgentExecutionError on error_during_execution', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runRedditCreator(creationInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentBudgetExceededError on error_max_budget_usd', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_budget_usd')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentBudgetExceededError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runRedditCreator(creationInputs)).rejects.toThrow(AgentBudgetExceededError)
  })

  it('passes correct tools to query() (Read, Glob)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validRedditContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    await runRedditCreator(creationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'Glob']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validRedditContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    await runRedditCreator(creationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('receives campaign plan + calendar + brand voice inputs', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validRedditContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    await runRedditCreator(creationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Campaign Plan')
    expect(callArgs.prompt).toContain('Content Calendar')
    expect(callArgs.prompt).toContain('Brand Voice')
    expect(callArgs.prompt).toContain('professional')
    expect(callArgs.prompt).toContain('authenticity')
    expect(callArgs.prompt).toContain('Trend Intelligence')
  })

  it('tracks token usage and cost from SDKResultMessage', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validRedditContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runRedditCreator(creationInputs)

    expect(result.usage).toBeDefined()
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeTypeOf('number')
  })

  it('throws AgentValidationError when output is invalid (AGENT_OUTPUT_INVALID)', async () => {
    const invalidOutput = {posts: [], generatedBy: 'reddit-creator'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runRedditCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runRedditCreator(creationInputs)).rejects.toThrow(AgentValidationError)
  })
})

describe('runTikTokCreator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid TikTokContentPackage on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTiktokContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTikTokCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runTikTokCreator(creationInputs)

    expect(result.agentName).toBe('tiktok-creator')
    expect(result.status).toBe('success')
    expect(result.outputs.scripts).toHaveLength(2)
    expect(result.outputs.scripts[0].scriptId).toBe('script-001')
    expect(result.outputs.scripts[0].hook.length).toBeGreaterThan(0)
    expect(result.outputs.scripts[0].onScreenText.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.captions).toHaveLength(2)
    expect(result.outputs.captions[0].hashtags.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.captions[0].keywords.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.videoPrompts).toHaveLength(2)
    expect(result.outputs.variations.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.generatedBy).toBe('tiktok-creator')
    expect(result.outputs.campaignId).toBe('plan-2026-03-wellness-spring')
  })

  it('throws AgentExecutionError on no result', async () => {
    // Simulate empty message stream (no result message)
    const mockQuery = createMockQuery([])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTikTokCreator} = await import('../../../src/lib/agents/creation.js')

    await expect(runTikTokCreator(creationInputs)).rejects.toThrow()
  })

  it('includes Veo 3 prompt generation in output', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTiktokContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTikTokCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runTikTokCreator(creationInputs)

    expect(result.outputs.videoPrompts.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.videoPrompts[0].veo3Prompt.length).toBeGreaterThanOrEqual(20)
    expect(result.outputs.videoPrompts[0].style).toBe('lo-fi')
    expect(result.outputs.videoPrompts[0].visualElements.length).toBeGreaterThanOrEqual(1)
  })

  it('includes 4-layer SEO in captions', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTiktokContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTikTokCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runTikTokCreator(creationInputs)

    // Layer 1: Caption text with keywords
    expect(result.outputs.captions[0].captionText.length).toBeGreaterThanOrEqual(10)
    // Layer 2: On-screen text in scripts
    expect(result.outputs.scripts[0].onScreenText.length).toBeGreaterThanOrEqual(1)
    // Layer 3: Audio keywords (script body contains spoken keywords)
    expect(result.outputs.scripts[0].body.length).toBeGreaterThan(0)
    // Layer 4: Hashtags
    expect(result.outputs.captions[0].hashtags.length).toBeGreaterThanOrEqual(1)
    // Keywords tracked explicitly
    expect(result.outputs.captions[0].keywords.length).toBeGreaterThanOrEqual(1)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {scripts: [], captions: [], generatedBy: 'tiktok-creator'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTikTokCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runTikTokCreator(creationInputs)).rejects.toThrow(AgentValidationError)
  })

  it('tracks token usage and cost', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTiktokContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTikTokCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runTikTokCreator(creationInputs)

    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
  })
})

describe('runFacebookCreator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid FacebookContentPackage on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validFacebookContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runFacebookCreator(creationInputs)

    expect(result.agentName).toBe('facebook-creator')
    expect(result.status).toBe('success')
    expect(result.outputs.posts).toHaveLength(2)
    expect(result.outputs.posts[0].postId).toBe('fb-post-001')
    expect(result.outputs.posts[0].format).toBe('text')
    expect(result.outputs.posts[0].engagementHook.length).toBeGreaterThan(0)
    expect(result.outputs.posts[0].targetGroups.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.stories.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.variations.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.metadata.groupTargets.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.metadata.boostRecommendations.length).toBeGreaterThan(0)
    expect(result.outputs.generatedBy).toBe('facebook-creator')
    expect(result.outputs.campaignId).toBe('plan-2026-03-wellness-spring')
  })

  it('throws AgentExecutionError on failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runFacebookCreator(creationInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('includes group targeting in output', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validFacebookContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runFacebookCreator(creationInputs)

    // Group targeting is present in posts and metadata
    expect(result.outputs.posts[0].targetGroups).toContain('wellnesscommunity')
    expect(result.outputs.metadata.groupTargets).toContain('wellnesscommunity')
    expect(result.outputs.metadata.crossPostStrategy.length).toBeGreaterThan(0)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {posts: [], generatedBy: 'facebook-creator'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runFacebookCreator(creationInputs)).rejects.toThrow(AgentValidationError)
  })

  it('passes correct tools to query() (Read, Glob)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validFacebookContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    await runFacebookCreator(creationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'Glob']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validFacebookContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    await runFacebookCreator(creationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('tracks token usage and cost', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validFacebookContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFacebookCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runFacebookCreator(creationInputs)

    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
  })
})

describe('runInstagramCreator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid InstagramContentPackage on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validInstagramContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runInstagramCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runInstagramCreator(creationInputs)

    expect(result.agentName).toBe('instagram-creator')
    expect(result.status).toBe('success')
    expect(result.outputs.posts).toHaveLength(2)
    expect(result.outputs.posts[0].postId).toBe('ig-post-001')
    expect(result.outputs.posts[0].caption.length).toBeGreaterThan(0)
    expect(result.outputs.posts[0].hashtags.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.posts[0].format).toBe('carousel')
    expect(result.outputs.posts[0].artDirection.length).toBeGreaterThan(0)
    expect(result.outputs.reels).toHaveLength(1)
    expect(result.outputs.stories).toHaveLength(1)
    expect(result.outputs.carousels).toHaveLength(1)
    expect(result.outputs.imagePrompts).toHaveLength(2)
    expect(result.outputs.variations.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.generatedBy).toBe('instagram-creator')
    expect(result.outputs.campaignId).toBe('plan-2026-03-wellness-spring')
  })

  it('includes Reels scripts and image prompts', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validInstagramContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runInstagramCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runInstagramCreator(creationInputs)

    // Reels
    expect(result.outputs.reels[0].hook.length).toBeGreaterThan(0)
    expect(result.outputs.reels[0].script.length).toBeGreaterThan(0)
    expect(result.outputs.reels[0].musicSuggestion.length).toBeGreaterThan(0)
    expect(result.outputs.reels[0].duration).toBeGreaterThan(0)

    // Image prompts
    expect(result.outputs.imagePrompts[0].promptText.length).toBeGreaterThanOrEqual(20)
    expect(result.outputs.imagePrompts[0].style).toBe('photography')
    expect(result.outputs.imagePrompts[0].aspectRatio).toBe('4:5')
    expect(result.outputs.imagePrompts[0].generator).toBe('flux')
  })

  it('throws AgentExecutionError on failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runInstagramCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runInstagramCreator(creationInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {posts: [], generatedBy: 'instagram-creator'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runInstagramCreator} = await import('../../../src/lib/agents/creation.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runInstagramCreator(creationInputs)).rejects.toThrow(AgentValidationError)
  })

  it('passes correct tools to query() (Read, Glob)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validInstagramContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runInstagramCreator} = await import('../../../src/lib/agents/creation.js')
    await runInstagramCreator(creationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'Glob']),
    )
  })

  it('tracks token usage and cost', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validInstagramContent)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runInstagramCreator} = await import('../../../src/lib/agents/creation.js')
    const result = await runInstagramCreator(creationInputs)

    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
  })
})

describe('runCreationStage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  /** Helper: create a mock query that routes by prompt content, including hook writer */
  function createStageQuery(options: {
    reddit?: boolean
    tiktok?: boolean
    facebook?: boolean
    instagram?: boolean
    hookWriter?: boolean
  } = {reddit: true, tiktok: true, facebook: true, instagram: true, hookWriter: true}) {
    return vi.fn((args: {prompt: string}) => {
      // Hook writer detection
      if (args.prompt.includes('Generate platform-tailored hook variations')) {
        if (options.hookWriter === false) {
          return (async function* () {
            yield {
              type: 'result' as const,
              subtype: 'error_during_execution' as const,
              result: '',
              total_cost_usd: 0.001,
              usage: {input_tokens: 100, output_tokens: 0},
              errors: ['Agent failed during execution'],
            }
          })()
        }
        return (async function* () {
          yield {
            type: 'result' as const,
            subtype: 'success' as const,
            result: JSON.stringify(validHookWriterOutput),
            total_cost_usd: 0.0025,
            usage: {input_tokens: 450, output_tokens: 380},
          }
        })()
      }

      // Platform agents
      let output: unknown
      let shouldFail = false
      if (args.prompt.includes('genuine community member')) {
        output = validRedditContent
        shouldFail = options.reddit === false
      } else if (args.prompt.includes('stops the scroll within 2 seconds')) {
        output = validTiktokContent
        shouldFail = options.tiktok === false
      } else if (args.prompt.includes('meaningful interactions (comments, shares)')) {
        output = validFacebookContent
        shouldFail = options.facebook === false
      } else if (args.prompt.includes('saves and shares')) {
        output = validInstagramContent
        shouldFail = options.instagram === false
      } else {
        output = validInstagramContent
        shouldFail = options.instagram === false
      }

      if (shouldFail) {
        return (async function* () {
          yield {
            type: 'result' as const,
            subtype: 'error_during_execution' as const,
            result: '',
            total_cost_usd: 0.001,
            usage: {input_tokens: 100, output_tokens: 0},
            errors: ['Agent failed during execution'],
          }
        })()
      }

      return (async function* () {
        yield {
          type: 'result' as const,
          subtype: 'success' as const,
          result: JSON.stringify(output),
          total_cost_usd: 0.0025,
          usage: {input_tokens: 450, output_tokens: 380},
        }
      })()
    })
  }

  it('runs all four platform agents plus hook writer (Phase 1 + Phase 2)', async () => {
    const mockQuery = createStageQuery()
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    // 4 platform agents + 1 hook writer = 5 calls
    expect(mockQuery).toHaveBeenCalledTimes(5)
    expect(result.stageMetadata.agentsExecuted).toEqual([
      'reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'hook-writer',
    ])
  })

  it('returns combined CreationStageOutput on all success (including hook writer)', async () => {
    const mockQuery = createStageQuery()
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    expect(result.redditPackage).not.toBeNull()
    expect(result.tiktokPackage).not.toBeNull()
    expect(result.facebookPackage).not.toBeNull()
    expect(result.instagramPackage).not.toBeNull()
    expect(result.redditPackage!.posts).toHaveLength(2)
    expect(result.tiktokPackage!.scripts).toHaveLength(2)
    expect(result.facebookPackage!.posts).toHaveLength(2)
    expect(result.instagramPackage!.posts).toHaveLength(2)
    expect(result.hookWriterOutput).not.toBeNull()
    expect(result.hookWriterOutput!.hooks.length).toBeGreaterThanOrEqual(1)
    expect(result.hookWriterOutput!.topPicks.length).toBeGreaterThanOrEqual(1)
    expect(result.hookWriterOutput!.abPairs.length).toBeGreaterThanOrEqual(1)
    expect(result.stageMetadata.agentsSucceeded).toEqual(
      expect.arrayContaining([
        'reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'hook-writer',
      ]),
    )
    expect(result.stageMetadata.agentsFailed).toEqual([])
  })

  it('returns partial results when some platform agents fail (degraded mode)', async () => {
    // Reddit and Facebook succeed, TikTok and Instagram fail, hook writer still runs
    const mockQuery = createStageQuery({reddit: true, tiktok: false, facebook: true, instagram: false, hookWriter: true})
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    // Partial success: Reddit and Facebook succeed, TikTok and Instagram fail
    expect(result.redditPackage).not.toBeNull()
    expect(result.facebookPackage).not.toBeNull()
    expect(result.tiktokPackage).toBeNull()
    expect(result.instagramPackage).toBeNull()
    // Hook writer still runs on available content items
    expect(result.hookWriterOutput).not.toBeNull()
    expect(result.stageMetadata.agentsSucceeded).toContain('reddit-creator')
    expect(result.stageMetadata.agentsSucceeded).toContain('facebook-creator')
    expect(result.stageMetadata.agentsSucceeded).toContain('hook-writer')
    expect(result.stageMetadata.agentsFailed).toContain('tiktok-creator')
    expect(result.stageMetadata.agentsFailed).toContain('instagram-creator')
    // agentErrors should capture failure reasons (M1)
    expect(result.stageMetadata.agentErrors).toBeDefined()
    expect(result.stageMetadata.agentErrors!['tiktok-creator']).toBeDefined()
    expect(result.stageMetadata.agentErrors!['instagram-creator']).toBeDefined()
    // ContentItems only from successful agents
    expect(result.contentItems.length).toBeGreaterThanOrEqual(1)
    const platforms = new Set(result.contentItems.map((i) => i.platform))
    expect(platforms.has('reddit')).toBe(true)
    expect(platforms.has('facebook')).toBe(true)
    expect(platforms.has('tiktok')).toBe(false)
    expect(platforms.has('instagram')).toBe(false)
  })

  it('handles partial failure: 3 agents fail, 1 succeeds, hook writer runs on remaining', async () => {
    // Only Instagram succeeds, hook writer runs on Instagram content
    const mockQuery = createStageQuery({reddit: false, tiktok: false, facebook: false, instagram: true, hookWriter: true})
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    expect(result.redditPackage).toBeNull()
    expect(result.tiktokPackage).toBeNull()
    expect(result.facebookPackage).toBeNull()
    expect(result.instagramPackage).not.toBeNull()
    expect(result.hookWriterOutput).not.toBeNull()
    expect(result.stageMetadata.agentsSucceeded).toContain('instagram-creator')
    expect(result.stageMetadata.agentsSucceeded).toContain('hook-writer')
    expect(result.stageMetadata.agentsFailed).toHaveLength(3)
    // agentErrors should capture failure reasons (M1)
    expect(result.stageMetadata.agentErrors).toBeDefined()
    expect(Object.keys(result.stageMetadata.agentErrors!)).toHaveLength(3)
    expect(result.contentItems.every((i) => i.platform === 'instagram')).toBe(true)
  })

  it('returns failed status when all platform agents fail (hook writer skipped)', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    expect(result.redditPackage).toBeNull()
    expect(result.tiktokPackage).toBeNull()
    expect(result.facebookPackage).toBeNull()
    expect(result.instagramPackage).toBeNull()
    expect(result.hookWriterOutput).toBeNull()
    expect(result.contentItems).toEqual([])
    expect(result.stageMetadata.agentsSucceeded).toEqual([])
    // hook-writer is skipped (not executed) when no content items — should NOT appear in agentsExecuted or agentsFailed
    expect(result.stageMetadata.agentsExecuted).toEqual([
      'reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator',
    ])
    expect(result.stageMetadata.agentsFailed).toEqual(
      expect.arrayContaining([
        'reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator',
      ]),
    )
    expect(result.stageMetadata.agentsFailed).not.toContain('hook-writer')
    // agentErrors should capture all failure reasons + hook-writer skip reason
    expect(result.stageMetadata.agentErrors).toBeDefined()
    expect(result.stageMetadata.agentErrors!['hook-writer']).toContain('no content items')
  })

  it('hook writer runs AFTER platform agents (receives ContentItem[] from Phase 1)', async () => {
    const callOrder: string[] = []
    const mockQuery = vi.fn((args: {prompt: string}) => {
      if (args.prompt.includes('Generate platform-tailored hook variations')) {
        callOrder.push('hook-writer')
        // Verify the hook writer receives content item IDs from platform agents
        expect(args.prompt).toContain('Content Items')
        return (async function* () {
          yield {
            type: 'result' as const,
            subtype: 'success' as const,
            result: JSON.stringify(validHookWriterOutput),
            total_cost_usd: 0.0025,
            usage: {input_tokens: 450, output_tokens: 380},
          }
        })()
      }

      // Platform agents
      callOrder.push('platform-agent')
      let output: unknown
      if (args.prompt.includes('genuine community member')) {
        output = validRedditContent
      } else if (args.prompt.includes('stops the scroll within 2 seconds')) {
        output = validTiktokContent
      } else if (args.prompt.includes('meaningful interactions (comments, shares)')) {
        output = validFacebookContent
      } else {
        output = validInstagramContent
      }

      return (async function* () {
        yield {
          type: 'result' as const,
          subtype: 'success' as const,
          result: JSON.stringify(output),
          total_cost_usd: 0.0025,
          usage: {input_tokens: 450, output_tokens: 380},
        }
      })()
    })
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    await runCreationStage(creationInputs)

    // Hook writer call must come AFTER all platform agent calls
    const hookWriterIndex = callOrder.lastIndexOf('hook-writer')
    expect(hookWriterIndex).toBe(callOrder.length - 1) // Last call
    expect(callOrder.filter((c) => c === 'platform-agent').length).toBe(4)
  })

  it('hook writer receives ContentItem[] from platform agents', async () => {
    const mockQuery = vi.fn((args: {prompt: string}) => {
      if (args.prompt.includes('Generate platform-tailored hook variations')) {
        // Verify content items are passed as JSON in the prompt
        expect(args.prompt).toContain('post-001') // Reddit post ID
        expect(args.prompt).toContain('script-001') // TikTok script ID
        return (async function* () {
          yield {
            type: 'result' as const,
            subtype: 'success' as const,
            result: JSON.stringify(validHookWriterOutput),
            total_cost_usd: 0.0025,
            usage: {input_tokens: 450, output_tokens: 380},
          }
        })()
      }

      let output: unknown
      if (args.prompt.includes('genuine community member')) {
        output = validRedditContent
      } else if (args.prompt.includes('stops the scroll within 2 seconds')) {
        output = validTiktokContent
      } else if (args.prompt.includes('meaningful interactions (comments, shares)')) {
        output = validFacebookContent
      } else {
        output = validInstagramContent
      }

      return (async function* () {
        yield {
          type: 'result' as const,
          subtype: 'success' as const,
          result: JSON.stringify(output),
          total_cost_usd: 0.0025,
          usage: {input_tokens: 450, output_tokens: 380},
        }
      })()
    })
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    expect(result.hookWriterOutput).not.toBeNull()
    expect(result.hookWriterOutput!.hooks.length).toBeGreaterThanOrEqual(1)
  })

  it('converts platform packages to ContentItem[] array including all four platforms', async () => {
    const mockQuery = createStageQuery()
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    // ContentItems from all four platforms
    // 2 reddit posts + 2 tiktok scripts + 3 facebook (2 posts + 1 story) + 5 instagram (2 posts + 1 reel + 1 story + 1 carousel)
    expect(result.contentItems.length).toBeGreaterThanOrEqual(12)

    // Check Reddit content items
    const redditItems = result.contentItems.filter((i) => i.platform === 'reddit')
    expect(redditItems.length).toBe(2)
    expect(redditItems[0].contentType).toBe('post')
    expect(redditItems[0].agentName).toBe('reddit-creator')
    expect(redditItems[0].status).toBe('draft')
    expect(redditItems[0].campaignId).toBe('plan-2026-03-wellness-spring')
    expect(redditItems[0].metadata).toHaveProperty('subreddit')
    expect(redditItems[0].metadata).toHaveProperty('firstComment')

    // Check TikTok content items
    const tiktokItems = result.contentItems.filter((i) => i.platform === 'tiktok')
    expect(tiktokItems.length).toBe(2)
    expect(tiktokItems[0].contentType).toBe('video-script')
    expect(tiktokItems[0].agentName).toBe('tiktok-creator')
    expect(tiktokItems[0].status).toBe('draft')
    expect(tiktokItems[0].metadata).toHaveProperty('hook')
    expect(tiktokItems[0].metadata).toHaveProperty('veo3Prompt')
    expect(tiktokItems[0].metadata).toHaveProperty('hashtags')

    // Check Facebook content items (posts + stories)
    const facebookItems = result.contentItems.filter((i) => i.platform === 'facebook')
    expect(facebookItems.length).toBe(3) // 2 posts + 1 story
    const facebookPosts = facebookItems.filter((i) => i.contentType !== 'story')
    const facebookStories = facebookItems.filter((i) => i.contentType === 'story')
    expect(facebookPosts.length).toBe(2)
    expect(facebookStories.length).toBe(1)
    expect(facebookPosts[0].agentName).toBe('facebook-creator')
    expect(facebookPosts[0].status).toBe('draft')
    expect(facebookPosts[0].metadata).toHaveProperty('targetGroups')
    expect(facebookPosts[0].metadata).toHaveProperty('groupTargets')
    expect(facebookStories[0].metadata).toHaveProperty('frames')
    expect(facebookStories[0].metadata).toHaveProperty('interactions')

    // Check Instagram content items (posts + reels + stories + carousels)
    const instagramItems = result.contentItems.filter((i) => i.platform === 'instagram')
    expect(instagramItems.length).toBe(5) // 2 posts + 1 reel + 1 story + 1 carousel
    const instagramPosts = instagramItems.filter((i) => 'hashtags' in (i.metadata as Record<string, unknown>))
    const instagramReels = instagramItems.filter((i) => i.contentType === 'reel')
    const instagramStories = instagramItems.filter((i) => i.contentType === 'story')
    const instagramCarousels = instagramItems.filter((i) => 'slides' in (i.metadata as Record<string, unknown>))
    expect(instagramPosts.length).toBe(2)
    expect(instagramReels.length).toBe(1)
    expect(instagramStories.length).toBe(1)
    expect(instagramCarousels.length).toBe(1)
    expect(instagramPosts[0].agentName).toBe('instagram-creator')
    expect(instagramPosts[0].metadata).toHaveProperty('hashtags')
    expect(instagramPosts[0].metadata).toHaveProperty('artDirection')
    expect(instagramReels[0].metadata).toHaveProperty('hook')
    expect(instagramReels[0].metadata).toHaveProperty('musicSuggestion')
    expect(instagramStories[0].metadata).toHaveProperty('stickers')
    expect(instagramStories[0].metadata).toHaveProperty('interactions')
    expect(instagramCarousels[0].metadata).toHaveProperty('slides')
    expect(instagramCarousels[0].metadata).toHaveProperty('swipeNarrative')
  })
})

describe('runHookWriter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  const hookWriterInputs = {
    contentItems: [
      {
        itemId: 'post-001',
        platform: 'reddit' as const,
        contentType: 'post',
        title: 'Test Reddit Post',
        body: 'Test body content for a Reddit post about wellness.',
        agentName: 'reddit-creator',
        generatedBy: 'reddit-creator',
        campaignId: 'plan-2026-03-wellness-spring',
        status: 'draft' as const,
        metadata: {},
        createdAt: '2026-03-15T10:00:00Z',
      },
      {
        itemId: 'script-001',
        platform: 'tiktok' as const,
        contentType: 'video-script',
        title: 'Test TikTok Script',
        body: 'Test TikTok script body about morning routines.',
        agentName: 'tiktok-creator',
        generatedBy: 'tiktok-creator',
        campaignId: 'plan-2026-03-wellness-spring',
        status: 'draft' as const,
        metadata: {},
        createdAt: '2026-03-15T10:00:00Z',
      },
    ],
    brandVoiceConfig: creationInputs.brandVoiceConfig,
    campaignPlan: validCampaignPlan,
  }

  it('returns valid HookWriterOutput on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    const result = await runHookWriter(hookWriterInputs)

    expect(result.agentName).toBe('hook-writer')
    expect(result.status).toBe('success')
    expect(result.outputs.hooks).toBeDefined()
    expect(result.outputs.hooks.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.topPicks).toBeDefined()
    expect(result.outputs.topPicks.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.abPairs).toBeDefined()
    expect(result.outputs.abPairs.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.analysis).toBeDefined()
  })

  it('generates hooks labelled with platform, trigger type, and archetype', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    const result = await runHookWriter(hookWriterInputs)

    for (const hook of result.outputs.hooks) {
      expect(hook.platform).toBeDefined()
      expect(['reddit', 'tiktok', 'facebook', 'instagram']).toContain(hook.platform)
      expect(hook.triggerType).toBeDefined()
      expect(hook.hookArchetype).toBeDefined()
      expect(hook.hookText.length).toBeGreaterThanOrEqual(1)
      expect(hook.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(hook.confidenceScore).toBeLessThanOrEqual(1)
      expect(hook.characterCount).toBeGreaterThanOrEqual(1)
    }
  })

  it('produces A/B pairs with variation strategy and rationale', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    const result = await runHookWriter(hookWriterInputs)

    for (const pair of result.outputs.abPairs) {
      expect(pair.pairId).toBeDefined()
      expect(pair.contentItemId).toBeDefined()
      expect(pair.platform).toBeDefined()
      expect(pair.hookA).toBeDefined()
      expect(pair.hookB).toBeDefined()
      expect(pair.hookA).not.toBe(pair.hookB)
      expect(pair.variationStrategy).toBeDefined()
      expect(pair.rationale.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('includes confidence scores between 0 and 1 on hooks', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    const result = await runHookWriter(hookWriterInputs)

    for (const hook of result.outputs.hooks) {
      expect(hook.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(hook.confidenceScore).toBeLessThanOrEqual(1)
    }
  })

  it('throws AgentExecutionError on agent failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')

    await expect(runHookWriter(hookWriterInputs)).rejects.toThrow()
  })

  it('throws AgentValidationError when contentItems is empty', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    const invalidInputs = {...hookWriterInputs, contentItems: []}

    await expect(runHookWriter(invalidInputs)).rejects.toThrow()
  })

  it('includes cost and usage metadata', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    const result = await runHookWriter(hookWriterInputs)

    expect(result.usage.cost).toBeGreaterThan(0)
    expect(result.usage.inputTokens).toBeGreaterThan(0)
    expect(result.usage.outputTokens).toBeGreaterThan(0)
  })

  it('passes correct tools to query() (Read)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    await runHookWriter(hookWriterInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHookWriterOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHookWriter} = await import('../../../src/lib/agents/creation.js')
    await runHookWriter(hookWriterInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })
})
