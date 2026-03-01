import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {ResearchInputs} from '../../../src/lib/agents/types.js'
import type {AudienceResearchInputs} from '../../../src/lib/schemas/audience-schema.js'

import validAudienceProfile from '../../fixtures/responses/claude-audience-profile.json'

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

const validViralPatternReport = {
  viralPatterns: [
    {
      platform: 'tiktok',
      pattern: 'Hook-in-first-second transformation reveal',
      description: 'Videos that immediately show a striking visual, then reveal the process.',
      frequency: 'common' as const,
      examples: ['Product transformation with trending sound'],
      replicabilityScore: 4,
    },
  ],
  hookAnalysis: [
    {
      hookType: 'Curiosity Gap',
      platform: 'tiktok',
      description: 'Opening with an intriguing statement that creates an information gap.',
      effectiveness: 'very-high' as const,
      examples: ['Wait for it...'],
    },
  ],
  captionStyles: [
    {
      platform: 'instagram',
      style: 'Micro-storytelling',
      description: 'Short personal anecdotes before the value proposition.',
      languagePatterns: ['First person narrative', 'Emotional opener'],
      engagementImpact: 'High save rate due to relatable storytelling',
    },
  ],
  hashtagStrategies: [
    {
      platform: 'instagram',
      strategy: '3-5-2 Stack',
      recommendedCount: 10,
      hashtagTypes: ['broad reach', 'niche community', 'branded'],
      examples: ['#marketing #saasmarketing'],
    },
  ],
  timingInsights: [
    {
      platform: 'tiktok',
      bestDays: ['Tuesday', 'Thursday', 'Friday'],
      bestHours: ['7:00 AM - 9:00 AM', '7:00 PM - 11:00 PM'],
      timezone: 'US Eastern (ET)',
      rationale: 'TikTok engagement peaks during morning scroll and evening windows.',
    },
  ],
  recommendations: 'Focus on hook-driven short-form video content on TikTok.',
}

const validAlgorithmReport = {
  platforms: [
    {
      name: 'tiktok',
      lastUpdated: '2026-02-28',
      overallStrategy: 'Focus on completion rate optimization.',
    },
  ],
  algorithmPriorities: [
    {
      platform: 'tiktok',
      priority: 'Video completion rate',
      weight: 'critical' as const,
      description: 'TikTok\'s #1 ranking signal for FYP distribution.',
      recentChanges: 'Longer videos now viable.',
    },
  ],
  rankingSignals: [
    {
      platform: 'tiktok',
      signal: 'Completion rate',
      impact: 'strong-positive' as const,
      description: 'Most important metric for FYP distribution.',
      actionable: true,
    },
  ],
  optimizationStrategies: [
    {
      platform: 'tiktok',
      strategy: 'Front-load the hook in first 0.5-1 second',
      description: 'Immediate visual impact to maximize retention.',
      expectedImpact: 'high' as const,
      implementation: 'Open with bold text overlay or surprising visual.',
      antiPatterns: ['Logo animations', 'Slow pans'],
    },
  ],
  recommendations: 'Prioritize completion rate optimization on TikTok.',
}

describe('runViralPatternDecoder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated ViralPatternReport on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validViralPatternReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runViralPatternDecoder(testInputs)

    expect(result.agentName).toBe('viral-pattern-decoder')
    expect(result.status).toBe('success')
    expect(result.outputs.viralPatterns).toHaveLength(1)
    expect(result.outputs.viralPatterns[0].platform).toBe('tiktok')
    expect(result.outputs.viralPatterns[0].frequency).toBe('common')
    expect(result.outputs.viralPatterns[0].replicabilityScore).toBe(4)
    expect(result.outputs.hookAnalysis).toHaveLength(1)
    expect(result.outputs.hookAnalysis[0].effectiveness).toBe('very-high')
    expect(result.outputs.captionStyles).toHaveLength(1)
    expect(result.outputs.hashtagStrategies).toHaveLength(1)
    expect(result.outputs.timingInsights).toHaveLength(1)
    expect(result.outputs.recommendations).toBeTruthy()
  })

  it('throws AgentExecutionError when API fails', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runViralPatternDecoder(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {viralPatterns: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runViralPatternDecoder(testInputs)).rejects.toThrow(AgentValidationError)
  })

  it('passes correct tools to query() (WebSearch, WebFetch, Read, Glob)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validViralPatternReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    await runViralPatternDecoder(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read', 'Glob']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validViralPatternReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    await runViralPatternDecoder(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('includes brand info and platforms in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validViralPatternReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    await runViralPatternDecoder(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('TestBrand')
    expect(callArgs.prompt).toContain('SaaS productivity')
    expect(callArgs.prompt).toContain('small business owners')
    expect(callArgs.prompt).toContain('tiktok, reddit')
  })

  it('tracks token usage in AgentResult', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validViralPatternReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runViralPatternDecoder(testInputs)

    expect(result.usage).toBeDefined()
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeTypeOf('number')
  })

  it('defaults timeframe to 30 days when not specified', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validViralPatternReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runViralPatternDecoder} = await import('../../../src/lib/agents/intelligence.js')
    const {trendTimeframeDays: _, ...inputsWithoutTimeframe} = testInputs
    await runViralPatternDecoder(inputsWithoutTimeframe as ResearchInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('30 days')
  })
})

describe('runPlatformAlgorithm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated PlatformAlgorithmReport on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAlgorithmReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runPlatformAlgorithm(testInputs)

    expect(result.agentName).toBe('platform-algorithm')
    expect(result.status).toBe('success')
    expect(result.outputs.platforms).toHaveLength(1)
    expect(result.outputs.platforms[0].name).toBe('tiktok')
    expect(result.outputs.algorithmPriorities).toHaveLength(1)
    expect(result.outputs.algorithmPriorities[0].weight).toBe('critical')
    expect(result.outputs.rankingSignals).toHaveLength(1)
    expect(result.outputs.rankingSignals[0].actionable).toBe(true)
    expect(result.outputs.optimizationStrategies).toHaveLength(1)
    expect(result.outputs.optimizationStrategies[0].expectedImpact).toBe('high')
    expect(result.outputs.recommendations).toBeTruthy()
  })

  it('throws AgentExecutionError when API fails', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runPlatformAlgorithm(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {platforms: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runPlatformAlgorithm(testInputs)).rejects.toThrow(AgentValidationError)
  })

  it('passes correct tools to query()', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAlgorithmReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    await runPlatformAlgorithm(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read', 'Glob']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAlgorithmReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    await runPlatformAlgorithm(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('includes brand info in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAlgorithmReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    await runPlatformAlgorithm(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('TestBrand')
    expect(callArgs.prompt).toContain('small business owners')
    expect(callArgs.prompt).toContain('tiktok, reddit')
    expect(callArgs.prompt).toContain('SaaS productivity')
  })

  it('tracks token usage in AgentResult', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAlgorithmReport)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runPlatformAlgorithm} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runPlatformAlgorithm(testInputs)

    expect(result.usage).toBeDefined()
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeTypeOf('number')
  })
})

const audienceResearchInputs: AudienceResearchInputs = {
  brandConfig: {
    brandName: 'WellnessApp',
    productDomain: 'health and wellness',
    tone: 'professional',
    communicationStyle: 'clear and direct',
    productName: 'WellnessApp',
  },
  verticalContext: 'Health & wellness industry vertical',
  competitorData: 'CompetitorCo is active on TikTok with wellness content',
}

describe('runAudienceResearcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated AudienceProfile on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runAudienceResearcher(audienceResearchInputs)

    expect(result.agentName).toBe('audience-researcher')
    expect(result.status).toBe('success')
    expect(result.outputs.profileId).toBe('ap-2026-03-wellness')
    expect(result.outputs.brandName).toBe('WellnessApp')
    expect(result.outputs.segments.length).toBeGreaterThanOrEqual(2)
    expect(result.outputs.segments[0].segmentName).toBe('Health-Conscious Millennials')
    expect(result.outputs.segments[0].demographics.ageRange).toBe('25-34')
    expect(result.outputs.segments[0].psychographics.valsType).toBe('Achievers')
    expect(result.outputs.painPoints.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.personas.length).toBeGreaterThanOrEqual(1)
  })

  it('runs in intelligence stage parallel with trend-scout (same stage cluster)', async () => {
    const {STAGE_AGENT_MAP} = await import('../../../src/lib/orchestrator/types.js')
    expect(STAGE_AGENT_MAP.research).toContain('audience-researcher')
    expect(STAGE_AGENT_MAP.research).toContain('trend-scout')
    expect(STAGE_AGENT_MAP.research).toContain('competitor-analyst')
  })

  it('throws AgentExecutionError on failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runAudienceResearcher(audienceResearchInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('audience profile includes platform usage patterns', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runAudienceResearcher(audienceResearchInputs)

    expect(result.outputs.platformUsage.length).toBeGreaterThanOrEqual(1)
    const tiktokUsage = result.outputs.platformUsage.find(p => p.platform === 'tiktok')
    expect(tiktokUsage).toBeDefined()
    expect(tiktokUsage!.audienceSize).toBeTruthy()
    expect(tiktokUsage!.primarySegments.length).toBeGreaterThanOrEqual(1)
    expect(tiktokUsage!.usagePattern).toBeTruthy()
    expect(tiktokUsage!.peakActivity).toBeTruthy()
    expect(tiktokUsage!.contentPreferences.length).toBeGreaterThanOrEqual(1)
  })

  it('audience profile includes personas with content preferences', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runAudienceResearcher(audienceResearchInputs)

    expect(result.outputs.personas.length).toBeGreaterThanOrEqual(1)
    const persona = result.outputs.personas[0]
    expect(persona.name).toBeTruthy()
    expect(persona.segment).toBeTruthy()
    expect(persona.primaryPlatforms.length).toBeGreaterThanOrEqual(1)
    expect(persona.contentPreferences.length).toBeGreaterThanOrEqual(1)
    expect(persona.painPoints.length).toBeGreaterThanOrEqual(1)
    expect(persona.behavioralIndicators.length).toBeGreaterThanOrEqual(3)
    expect(persona.messagingAngle).toBeTruthy()
  })

  it('throws AgentValidationError when output is invalid', async () => {
    const invalidOutput = {profileId: 'test', segments: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runAudienceResearcher(audienceResearchInputs)).rejects.toThrow(AgentValidationError)
  })

  it('includes brand info and context in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    await runAudienceResearcher(audienceResearchInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('WellnessApp')
    expect(callArgs.prompt).toContain('health and wellness')
    expect(callArgs.prompt).toContain('Industry Vertical Context')
    expect(callArgs.prompt).toContain('Competitor Data')
  })

  it('passes correct tools from SKILL.md (WebSearch, WebFetch, Read, Glob)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    await runAudienceResearcher(audienceResearchInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read', 'Glob']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    await runAudienceResearcher(audienceResearchInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('tracks token usage in AgentResult', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runAudienceResearcher(audienceResearchInputs)

    expect(result.usage).toBeDefined()
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeTypeOf('number')
  })

  it('works without optional vertical and competitor data', async () => {
    const minimalInputs: AudienceResearchInputs = {
      brandConfig: {
        brandName: 'TestBrand',
        productDomain: 'SaaS',
      },
    }

    const mockQuery = createMockQuery([createSuccessMessage(validAudienceProfile)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAudienceResearcher} = await import('../../../src/lib/agents/intelligence.js')
    const result = await runAudienceResearcher(minimalInputs)

    expect(result.status).toBe('success')

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('TestBrand')
    expect(callArgs.prompt).not.toContain('Industry Vertical Context')
    expect(callArgs.prompt).not.toContain('Competitor Data')
  })
})

describe('runTrendScout deprioritization integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('includes deprioritization context in system prompt when rejections exist', async () => {
    // Mock AgentMemoryStore to return rejection entries — use a class so `new` works
    vi.doMock('../../../src/lib/agents/memory-store.js', () => {
      const state = {
        agentName: 'trend-scout',
        lastRunId: null,
        lastRunAt: null,
        entries: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            runId: 'rejection-test',
            timestamp: '2026-03-01T10:00:00.000Z',
            type: 'rejection',
            content: JSON.stringify({
              id: '550e8400-e29b-41d4-a716-446655440000',
              contentItemId: 'item-1',
              rejectedAngle: 'meditation benefits for corporate productivity',
              rejectionReason: 'Too generic',
              agentName: 'trend-scout',
              timestamp: '2026-03-01T10:00:00.000Z',
              keywords: ['meditation', 'benefits', 'corporate', 'productivity'],
              confidence: 1.0,
            }),
            source: 'review-queue',
            confidence: 1.0,
          },
        ],
        metadata: {},
      }
      return {
        AgentMemoryStore: class {
          load = vi.fn().mockResolvedValue(state)
        },
      }
    })

    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    await runTrendScout(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Previously Rejected Content Angles')
    expect(callArgs.options.systemPrompt).toContain('meditation benefits for corporate productivity')
    expect(callArgs.options.systemPrompt).toContain('DO NOT suggest content')
  })

  it('does not include deprioritization section when no rejections exist', async () => {
    // Mock AgentMemoryStore to return empty state
    vi.doMock('../../../src/lib/agents/memory-store.js', () => {
      const state = {
        agentName: 'trend-scout',
        lastRunId: null,
        lastRunAt: null,
        entries: [],
        metadata: {},
      }
      return {
        AgentMemoryStore: class {
          load = vi.fn().mockResolvedValue(state)
        },
      }
    })

    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    await runTrendScout(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).not.toContain('Previously Rejected Content Angles')
  })

  it('deprioritization context is appended to system prompt, not user prompt', async () => {
    vi.doMock('../../../src/lib/agents/memory-store.js', () => {
      const state = {
        agentName: 'trend-scout',
        lastRunId: null,
        lastRunAt: null,
        entries: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            runId: 'rejection-test',
            timestamp: '2026-03-01T10:00:00.000Z',
            type: 'rejection',
            content: JSON.stringify({
              id: '550e8400-e29b-41d4-a716-446655440000',
              contentItemId: 'item-1',
              rejectedAngle: 'competitor pricing comparison',
              rejectionReason: 'Legal concerns',
              agentName: 'trend-scout',
              timestamp: '2026-03-01T10:00:00.000Z',
              keywords: ['competitor', 'pricing', 'comparison'],
              confidence: 1.0,
            }),
            source: 'review-queue',
            confidence: 1.0,
          },
        ],
        metadata: {},
      }
      return {
        AgentMemoryStore: class {
          load = vi.fn().mockResolvedValue(state)
        },
      }
    })

    const mockQuery = createMockQuery([createSuccessMessage(validTrendBrief)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runTrendScout} = await import('../../../src/lib/agents/intelligence.js')
    await runTrendScout(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string; options: {systemPrompt: string}}
    // Deprioritization should be in systemPrompt, NOT in prompt
    expect(callArgs.options.systemPrompt).toContain('Previously Rejected Content Angles')
    expect(callArgs.prompt).not.toContain('Previously Rejected Content Angles')
  })
})
