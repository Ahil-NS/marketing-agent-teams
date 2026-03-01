import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {SeoContentItem} from '../../../src/lib/schemas/seo-schema.js'
import type {SeoOptimizationInputs} from '../../../src/lib/agents/optimization.js'
import type {HumanizationInputs} from '../../../src/lib/agents/optimization.js'

// --- Valid mock data ---

const validContentItems: SeoContentItem[] = [
  {
    contentId: 'tiktok-1',
    platform: 'tiktok',
    body: 'Check out our amazing wellness meditation app!',
    hashtags: ['#wellness', '#meditation'],
  },
  {
    contentId: 'reddit-1',
    platform: 'reddit',
    title: 'How meditation changed my productivity',
    body: 'I started using a wellness app three months ago and the results have been incredible...',
  },
]

const validSeoOutput = {
  items: [
    {
      contentId: 'tiktok-1',
      platform: 'tiktok',
      originalContent: {
        contentId: 'tiktok-1',
        platform: 'tiktok',
        body: 'Check out our amazing wellness meditation app!',
        hashtags: ['#wellness', '#meditation'],
      },
      optimizedContent: {
        contentId: 'tiktok-1',
        platform: 'tiktok',
        body: 'Transform your daily routine with mindful meditation — wellness starts here',
        hashtags: ['#wellness', '#meditation', '#mindfulness'],
      },
      appliedRules: [
        {
          ruleType: 'keyword-density',
          before: 'Check out our amazing wellness meditation app!',
          after: 'Transform your daily routine with mindful meditation — wellness starts here',
          rationale: 'Front-loaded keywords in caption for TikTok indexing',
        },
        {
          ruleType: 'hashtag-count',
          before: '2 hashtags',
          after: '3 hashtags',
          rationale: 'Increased to meet platform minimum of 3 hashtags',
        },
      ],
      seoScore: 88,
      recommendations: ['Add OCR text overlay with primary keyword', 'Include audio keyword in first 5 seconds'],
    },
    {
      contentId: 'reddit-1',
      platform: 'reddit',
      originalContent: {
        contentId: 'reddit-1',
        platform: 'reddit',
        title: 'How meditation changed my productivity',
        body: 'I started using a wellness app three months ago and the results have been incredible...',
      },
      optimizedContent: {
        contentId: 'reddit-1',
        platform: 'reddit',
        title: 'Meditation for Productivity: How a wellness app changed my work-life balance',
        body: 'I started using a wellness app three months ago and the results have been incredible...',
      },
      appliedRules: [
        {
          ruleType: 'keyword-density',
          before: 'How meditation changed my productivity',
          after: 'Meditation for Productivity: How a wellness app changed my work-life balance',
          rationale: 'Front-loaded keywords in title for Reddit Google search visibility',
        },
      ],
      seoScore: 82,
      recommendations: ['Expand body to 300-500 word optimal range'],
    },
  ],
  summary: {
    totalItems: 2,
    averageSeoScore: 85,
    platformBreakdown: {
      tiktok: {count: 1, averageScore: 88},
      reddit: {count: 1, averageScore: 82},
    },
  },
}

const testInputs: SeoOptimizationInputs = {
  contentItems: validContentItems,
  platforms: ['tiktok', 'reddit'],
  brandKeywords: ['wellness', 'meditation'],
  campaignKeywords: ['mindfulness', 'productivity'],
}

describe('runSeoOptimizer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid SeoOptimizationOutput on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    const result = await runSeoOptimizer(testInputs)

    expect(result.agentName).toBe('seo-optimizer')
    expect(result.status).toBe('success')
    expect(result.outputs.items).toHaveLength(2)
    expect(result.outputs.items[0].seoScore).toBe(88)
    expect(result.outputs.items[1].seoScore).toBe(82)
    expect(result.outputs.summary.totalItems).toBe(2)
    expect(result.outputs.summary.averageSeoScore).toBe(85)
  })

  it('passes correct systemPrompt including knowledgeContext to executeAgent', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    await runSeoOptimizer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('passes correct allowedTools [Read, WebSearch] to executeAgent', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    await runSeoOptimizer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'WebSearch']),
    )
  })

  it('applies platform-specific configs per item', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    await runSeoOptimizer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    // Prompt should contain platform configs
    expect(callArgs.prompt).toContain('tiktok')
    expect(callArgs.prompt).toContain('reddit')
    // Platform configs should include SEO-specific data
    expect(callArgs.prompt).toContain('keywordDensity')
    expect(callArgs.prompt).toContain('hashtagRange')
    expect(callArgs.prompt).toContain('rankingSignals')
  })

  it('throws error on agent failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runSeoOptimizer(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('handles multi-platform content batch (TikTok + Reddit in same call)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    const result = await runSeoOptimizer(testInputs)

    expect(result.outputs.items).toHaveLength(2)
    const platforms = result.outputs.items.map(i => i.platform)
    expect(platforms).toContain('tiktok')
    expect(platforms).toContain('reddit')
    expect(result.outputs.summary.platformBreakdown.tiktok).toBeDefined()
    expect(result.outputs.summary.platformBreakdown.reddit).toBeDefined()
  })

  it('TikTok content optimization includes all 4 indexable layers in prompt', async () => {
    const tiktokOnlyInputs: SeoOptimizationInputs = {
      contentItems: [validContentItems[0]],
      platforms: ['tiktok'],
      brandKeywords: ['wellness'],
    }

    const tiktokOnlyOutput = {
      items: [validSeoOutput.items[0]],
      summary: {totalItems: 1, averageSeoScore: 88, platformBreakdown: {tiktok: {count: 1, averageScore: 88}}},
    }

    const mockQuery = createMockQuery([createSuccessMessage(tiktokOnlyOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    await runSeoOptimizer(tiktokOnlyInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    // TikTok 4 indexable layers should be in the prompt (via platform config)
    expect(callArgs.prompt).toContain('captionText')
    expect(callArgs.prompt).toContain('ocrTextOverlay')
    expect(callArgs.prompt).toContain('audioKeywords')
    expect(callArgs.prompt).toContain('hashtags')
    // Explicit instruction about 4 layers
    expect(callArgs.prompt).toContain('4 indexable layers')
  })

  it('includes brand and campaign keywords in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    await runSeoOptimizer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('wellness')
    expect(callArgs.prompt).toContain('meditation')
    expect(callArgs.prompt).toContain('Campaign Keywords')
    expect(callArgs.prompt).toContain('mindfulness')
    expect(callArgs.prompt).toContain('productivity')
  })

  it('omits Campaign Keywords section when campaignKeywords is undefined', async () => {
    const inputsWithoutCampaign: SeoOptimizationInputs = {
      contentItems: validContentItems,
      platforms: ['tiktok', 'reddit'],
      brandKeywords: ['wellness', 'meditation'],
    }

    const mockQuery = createMockQuery([createSuccessMessage(validSeoOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    await runSeoOptimizer(inputsWithoutCampaign)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('wellness')
    expect(callArgs.prompt).toContain('meditation')
    expect(callArgs.prompt).not.toContain('Campaign Keywords')
  })

  it('throws AgentValidationError when output shape is invalid', async () => {
    const invalidOutput = {items: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSeoOptimizer} = await import('../../../src/lib/agents/optimization.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runSeoOptimizer(testInputs)).rejects.toThrow(AgentValidationError)
  })
})

// --- Content Humanization Tests ---

const validHumanizationOutput = {
  items: [
    {
      contentId: 'reddit-wellness-1',
      platform: 'reddit',
      originalText: "In today's digital landscape, meditation has emerged as a groundbreaking solution.",
      humanizedText: "So I've been meditating for about 3 months now and honestly? Game changer.",
      aiMarkersRemoved: [
        {marker: "In today's digital landscape", location: 'opening sentence', replacement: 'Personal anecdote opener'},
        {marker: 'groundbreaking', location: 'first sentence', replacement: 'Game changer'},
      ],
      techniquesApplied: ['sentence-length-variation', 'banned-phrase-removal', 'personal-anecdote-framing'],
      estimatedAiScore: 12,
      brandVoiceConsistency: 85,
      meaningPreserved: true,
    },
  ],
  summary: {
    totalItems: 1,
    averageAiScore: 12,
    averageBrandVoiceScore: 85,
    itemsBelowThreshold: 1,
    itemsAboveThreshold: 0,
  },
}

const humanizationInputs: HumanizationInputs = {
  contentItems: [
    {
      contentId: 'reddit-wellness-1',
      platform: 'reddit',
      text: "In today's digital landscape, meditation has emerged as a groundbreaking solution.",
    },
  ],
  aiDetectionThreshold: 20,
}

describe('runContentHumanizer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid HumanizationOutput on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    const result = await runContentHumanizer(humanizationInputs)

    expect(result.agentName).toBe('content-humanizer')
    expect(result.status).toBe('success')
    expect(result.outputs.items).toHaveLength(1)
    expect(result.outputs.items[0].contentId).toBe('reddit-wellness-1')
    expect(result.outputs.items[0].estimatedAiScore).toBe(12)
    expect(result.outputs.summary.totalItems).toBe(1)
  })

  it('uses model: sonnet for creative rewriting', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer(humanizationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('sonnet')
  })

  it('passes correct allowedTools [Read] to executeAgent', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer(humanizationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(['Read'])
  })

  it('includes AI-detection threshold in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer({...humanizationInputs, aiDetectionThreshold: 15})

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('15%')
  })

  it('includes default banned phrases in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer(humanizationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain("In today's digital landscape")
    expect(callArgs.prompt).toContain('Dive into')
    expect(callArgs.prompt).toContain('Unlock the power')
    expect(callArgs.prompt).toContain('Delve into')
    expect(callArgs.prompt).toContain('Utilize')
  })

  it('includes brand voice config in prompt when provided', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer({
      ...humanizationInputs,
      brandVoiceConfig: {
        tone: 'friendly',
        style: 'conversational',
        principles: ['authenticity', 'warmth'],
      },
    })

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Brand Voice Configuration')
    expect(callArgs.prompt).toContain('friendly')
    expect(callArgs.prompt).toContain('conversational')
    expect(callArgs.prompt).toContain('authenticity')
    expect(callArgs.prompt).toContain('warmth')
  })

  it('omits brand voice section when brandVoiceConfig is not provided', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer(humanizationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).not.toContain('Brand Voice Configuration')
  })

  it('merges custom banned phrases with defaults', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer({
      ...humanizationInputs,
      bannedPhrases: ['Custom banned phrase'],
    })

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    // Default phrases still present
    expect(callArgs.prompt).toContain("In today's digital landscape")
    // Custom phrase also present
    expect(callArgs.prompt).toContain('Custom banned phrase')
  })

  it('deduplicates banned phrases', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer({
      ...humanizationInputs,
      bannedPhrases: ['Dive into'], // Already in defaults
    })

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    // count occurrences of "Dive into" — should appear exactly once in the banned phrases list
    const matches = callArgs.prompt.match(/"Dive into"/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('throws error on agent failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runContentHumanizer(humanizationInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('handles multi-platform content batch', async () => {
    const multiPlatformOutput = {
      items: [
        {...validHumanizationOutput.items[0]},
        {
          ...validHumanizationOutput.items[0],
          contentId: 'tiktok-1',
          platform: 'tiktok',
          estimatedAiScore: 8,
        },
      ],
      summary: {
        totalItems: 2,
        averageAiScore: 10,
        averageBrandVoiceScore: 85,
        itemsBelowThreshold: 2,
        itemsAboveThreshold: 0,
      },
    }
    const mockQuery = createMockQuery([createSuccessMessage(multiPlatformOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    const result = await runContentHumanizer({
      contentItems: [
        {contentId: 'reddit-1', platform: 'reddit', text: 'Test reddit content'},
        {contentId: 'tiktok-1', platform: 'tiktok', text: 'Test tiktok content'},
      ],
      aiDetectionThreshold: 20,
    })

    expect(result.outputs.items).toHaveLength(2)
    const platforms = result.outputs.items.map(i => i.platform)
    expect(platforms).toContain('reddit')
    expect(platforms).toContain('tiktok')
    expect(result.outputs.summary.totalItems).toBe(2)
  })

  it('throws AgentValidationError when output shape is invalid', async () => {
    const invalidOutput = {items: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runContentHumanizer(humanizationInputs)).rejects.toThrow(AgentValidationError)
  })

  it('includes knowledgeContext in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHumanizationOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentHumanizer} = await import('../../../src/lib/agents/optimization.js')
    await runContentHumanizer(humanizationInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })
})
