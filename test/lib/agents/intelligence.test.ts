import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {ResearchInputs} from '../../../src/lib/agents/types.js'

const validTrendBrief = {
  trends: [
    {
      name: 'Short-form video',
      platform: 'tiktok',
      description: 'Brands using short videos see higher engagement',
      engagementMetrics: {
        source: 'TikTok Creative Center',
        recency: '2026-02-28',
        volume: 1500000,
      },
      trajectory: 'emerging' as const,
      relevanceScore: 4,
    },
  ],
  viralPatterns: [
    {
      pattern: 'Hook-in-first-3-seconds',
      platforms: ['tiktok', 'instagram'],
      format: 'short-form video',
      examples: ['Wait for it...'],
    },
  ],
  opportunities: [
    {
      description: 'Create behind-the-scenes content',
      relevanceScore: 5,
      timelinessScore: 4,
      platforms: ['tiktok', 'instagram'],
      suggestedAngle: 'Day-in-the-life format showing product development',
    },
  ],
  risks: [
    {
      description: 'Trend may peak within 2 weeks',
      severity: 'medium' as const,
      mitigation: 'Publish within 5 business days to capitalize',
    },
  ],
  recommendations: 'Focus on short-form video content across TikTok and Instagram, targeting the behind-the-scenes narrative.',
}

const validCompetitorReport = {
  competitors: [
    {
      name: 'CompetitorCo',
      platforms: [
        {
          platform: 'tiktok',
          handle: '@competitorco',
          followerCount: 50000,
          postingFrequency: '3 times/week',
          engagementRate: '4.5%',
          contentTypes: ['tutorials', 'product demos'],
        },
      ],
    },
  ],
  contentAnalysis: [
    {
      competitor: 'CompetitorCo',
      topPerformingContent: [
        {
          platform: 'tiktok',
          description: 'Product comparison video with trending sound',
          engagementSignals: '50K views, 5K likes, 200 comments',
          format: 'short-form video',
        },
      ],
    },
  ],
  viralContent: [
    {
      competitor: 'CompetitorCo',
      platform: 'tiktok',
      description: 'Behind-the-scenes manufacturing video',
      whyViral: 'Authentic tone combined with trending sound and satisfying process footage',
      replicabilityScore: 4,
    },
  ],
  gaps: [
    {
      area: 'Reddit presence',
      description: 'CompetitorCo has no Reddit strategy despite active audience in r/productivity',
      opportunity: 'Establish community presence via AMA and valuable discussions',
    },
  ],
  recommendations: 'Target Reddit as an uncontested channel and leverage behind-the-scenes content format.',
}

const testInputs: ResearchInputs = {
  brandName: 'TestBrand',
  productDomain: 'SaaS productivity',
  audienceType: 'small business owners',
  platforms: ['tiktok', 'reddit'],
  trendTimeframeDays: 14,
}

describe('runTrendScout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated TrendBrief on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runTrendScout(testInputs)

    expect(result.agentName).toBe('trend-scout')
    expect(result.status).toBe('success')
    expect(result.outputs.trends).toHaveLength(1)
    expect(result.outputs.trends[0].name).toBe('Short-form video')
    expect(result.outputs.trends[0].platform).toBe('tiktok')
    expect(result.outputs.trends[0].engagementMetrics.source).toBe('TikTok Creative Center')
    expect(result.outputs.trends[0].trajectory).toBe('emerging')
    expect(result.outputs.trends[0].relevanceScore).toBe(4)
    expect(result.outputs.viralPatterns).toHaveLength(1)
    expect(result.outputs.viralPatterns[0].platforms).toEqual(['tiktok', 'instagram'])
    expect(result.outputs.viralPatterns[0].format).toBe('short-form video')
    expect(result.outputs.opportunities).toHaveLength(1)
    expect(result.outputs.opportunities[0].relevanceScore).toBe(5)
    expect(result.outputs.opportunities[0].suggestedAngle).toBeTruthy()
    expect(result.outputs.risks).toHaveLength(1)
    expect(result.outputs.risks[0].severity).toBe('medium')
    expect(result.outputs.recommendations).toBeTruthy()
  })

  it('includes brand info and platforms in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    await runTrendScout(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('TestBrand')
    expect(callArgs.prompt).toContain('SaaS productivity')
    expect(callArgs.prompt).toContain('small business owners')
    expect(callArgs.prompt).toContain('tiktok, reddit')
    expect(callArgs.prompt).toContain('14 days')
  })

  it('defaults timeframe to 30 days when not specified', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    const {trendTimeframeDays: _, ...inputsWithoutTimeframe} = testInputs
    await runTrendScout(inputsWithoutTimeframe as ResearchInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('30 days')
  })

  it('passes correct tools from SKILL.md to agent executor', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    await runTrendScout(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read', 'Glob']),
    )
  })

  it('includes knowledge context in system prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    await runTrendScout(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    // The system prompt should include knowledge base content from knowledge/ files
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('throws AgentExecutionError when API fails', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runTrendScout(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError when output shape is invalid', async () => {
    const invalidOutput = {trends: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runTrendScout(testInputs)).rejects.toThrow(AgentValidationError)
  })

  it('tracks token usage in AgentResult', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runTrendScout(testInputs)

    expect(result.usage).toBeDefined()
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeTypeOf('number')
  })
})

describe('runCompetitorAnalyst', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated CompetitorReport on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCompetitorReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCompetitorAnalyst} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runCompetitorAnalyst(testInputs)

    expect(result.agentName).toBe('competitor-analyst')
    expect(result.status).toBe('success')
    expect(result.outputs.competitors).toHaveLength(1)
    expect(result.outputs.competitors[0].name).toBe('CompetitorCo')
    expect(result.outputs.competitors[0].platforms).toHaveLength(1)
    expect(result.outputs.competitors[0].platforms[0].engagementRate).toBe('4.5%')
    expect(result.outputs.contentAnalysis).toHaveLength(1)
    expect(result.outputs.viralContent).toHaveLength(1)
    expect(result.outputs.viralContent[0].replicabilityScore).toBe(4)
    expect(result.outputs.gaps).toHaveLength(1)
    expect(result.outputs.recommendations).toBeTruthy()
  })

  it('throws AgentExecutionError when API fails', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCompetitorAnalyst} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runCompetitorAnalyst(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {competitors: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCompetitorAnalyst} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runCompetitorAnalyst(testInputs)).rejects.toThrow(AgentValidationError)
  })

  it('includes competitor analysis context in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCompetitorReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCompetitorAnalyst} = await import('../../../src/lib/agents/intelligence.js')
    await runCompetitorAnalyst(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('TestBrand')
    expect(callArgs.prompt).toContain('SaaS productivity')
    expect(callArgs.prompt).toContain('competitor')
  })

  it('passes correct tools from SKILL.md', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCompetitorReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCompetitorAnalyst} = await import('../../../src/lib/agents/intelligence.js')
    await runCompetitorAnalyst(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read']),
    )
  })
})
