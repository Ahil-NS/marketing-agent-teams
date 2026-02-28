import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {CreationInputs} from '../../../src/lib/schemas/creation-schema.js'

import validRedditContent from '../../fixtures/responses/claude-reddit-content.json'
import validTiktokContent from '../../fixtures/responses/claude-tiktok-content.json'
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

describe('runCreationStage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('runs both agents in parallel via Promise.allSettled', async () => {
    const callOrder: string[] = []
    const mockQuery = vi.fn((args: {prompt: string}) => {
      const isReddit = args.prompt.includes('genuine community member')
      callOrder.push(isReddit ? 'reddit' : 'tiktok')
      const output = isReddit ? validRedditContent : validTiktokContent
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

    // Both agents were called
    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(result.stageMetadata.agentsExecuted).toEqual(['reddit-creator', 'tiktok-creator'])
  })

  it('returns combined CreationStageOutput on both success', async () => {
    const mockQuery = vi.fn((args: {prompt: string}) => {
      const isReddit = args.prompt.includes('genuine community member')
      const output = isReddit ? validRedditContent : validTiktokContent
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

    expect(result.redditPackage).not.toBeNull()
    expect(result.tiktokPackage).not.toBeNull()
    expect(result.redditPackage!.posts).toHaveLength(2)
    expect(result.tiktokPackage!.scripts).toHaveLength(2)
    expect(result.stageMetadata.agentsSucceeded).toEqual(['reddit-creator', 'tiktok-creator'])
    expect(result.stageMetadata.agentsFailed).toEqual([])
  })

  it('returns partial results when one agent fails (degraded mode)', async () => {
    const mockQuery = vi.fn((args: {prompt: string}) => {
      const isReddit = args.prompt.includes('genuine community member')
      if (isReddit) {
        // Reddit agent succeeds
        return (async function* () {
          yield {
            type: 'result' as const,
            subtype: 'success' as const,
            result: JSON.stringify(validRedditContent),
            total_cost_usd: 0.0025,
            usage: {input_tokens: 450, output_tokens: 380},
          }
        })()
      }

      // TikTok agent fails
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
    })
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    // Partial success: Reddit succeeds, TikTok fails
    expect(result.redditPackage).not.toBeNull()
    expect(result.tiktokPackage).toBeNull()
    expect(result.stageMetadata.agentsSucceeded).toContain('reddit-creator')
    expect(result.stageMetadata.agentsFailed).toContain('tiktok-creator')
    expect(result.stageMetadata.agentsSucceeded.length).toBe(1)
    expect(result.stageMetadata.agentsFailed.length).toBe(1)
    // ContentItems only from successful agent
    expect(result.contentItems.length).toBeGreaterThanOrEqual(1)
    expect(result.contentItems.every((i) => i.platform === 'reddit')).toBe(true)
  })

  it('returns failed status when both agents fail', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCreationStage} = await import('../../../src/lib/agents/creation.js')
    const result = await runCreationStage(creationInputs)

    expect(result.redditPackage).toBeNull()
    expect(result.tiktokPackage).toBeNull()
    expect(result.contentItems).toEqual([])
    expect(result.stageMetadata.agentsSucceeded).toEqual([])
    expect(result.stageMetadata.agentsFailed).toEqual(['reddit-creator', 'tiktok-creator'])
  })

  it('converts platform packages to ContentItem[] array', async () => {
    const mockQuery = vi.fn((args: {prompt: string}) => {
      const isReddit = args.prompt.includes('genuine community member')
      const output = isReddit ? validRedditContent : validTiktokContent
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

    // ContentItems from both platforms
    expect(result.contentItems.length).toBeGreaterThanOrEqual(4) // 2 reddit posts + 2 tiktok scripts

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
  })
})
