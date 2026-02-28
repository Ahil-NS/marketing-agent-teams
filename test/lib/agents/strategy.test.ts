import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {StrategyInputs, CalendarInputs, OptimizerInputs} from '../../../src/lib/schemas/strategy-schema.js'

import validCampaignPlan from '../../fixtures/responses/claude-campaign-plan.json'
import validContentCalendar from '../../fixtures/responses/claude-content-calendar.json'
import validChannelOptimization from '../../fixtures/responses/claude-channel-optimization.json'

const strategyInputs: StrategyInputs = {
  trendBrief: {
    trends: [{
      name: 'Short-form video',
      platform: 'tiktok',
      description: 'Trending format',
      engagementMetrics: {source: 'TikTok Analytics', recency: '2026-02-28'},
      trajectory: 'emerging',
      relevanceScore: 4,
    }],
    viralPatterns: [{
      pattern: 'Hook-in-3-seconds',
      platforms: ['tiktok'],
      format: 'short-form-video',
    }],
    opportunities: [{
      description: 'Early mover on wellness TikTok',
      relevanceScore: 4,
      timelinessScore: 5,
      platforms: ['tiktok'],
      suggestedAngle: 'Morning routine tips under 30 seconds',
    }],
    risks: [{
      description: 'Trend saturation in wellness space',
      severity: 'medium',
      mitigation: 'Differentiate through expert authority',
    }],
    recommendations: 'Focus on short-form content',
  },
  competitorReport: {
    competitors: [{
      name: 'CompetitorCo',
      platforms: [{
        platform: 'reddit',
        postingFrequency: '3/week',
        engagementRate: '2.5%',
        contentTypes: ['educational', 'engagement'],
      }],
    }],
    contentAnalysis: [{
      competitor: 'CompetitorCo',
      topPerformingContent: [{
        platform: 'reddit',
        description: 'Wellness AMA post',
        engagementSignals: '500 upvotes, 200 comments',
        format: 'text-post',
      }],
    }],
    viralContent: [{
      competitor: 'CompetitorCo',
      platform: 'tiktok',
      description: 'Morning routine video',
      whyViral: 'Trend alignment + authentic style',
      replicabilityScore: 3,
    }],
    gaps: [{
      area: 'Reddit community engagement',
      description: 'No competitor active on Reddit wellness subreddits',
      opportunity: 'Build authority through AMA and expert posts',
    }],
    recommendations: 'Target Reddit as uncontested channel',
  },
  viralPatternReport: {
    viralPatterns: [{
      platform: 'tiktok',
      pattern: 'Hook-in-3-seconds',
      description: 'Strong hooks drive completion rate',
      frequency: 'common',
      replicabilityScore: 4,
    }],
    hookAnalysis: [{
      hookType: 'question-hook',
      platform: 'tiktok',
      description: 'Open with a provocative question',
      effectiveness: 'high',
    }],
    captionStyles: [{
      platform: 'tiktok',
      style: 'conversational',
      description: 'Casual, first-person captions perform best',
      languagePatterns: ['you', 'we', 'let me show you'],
      engagementImpact: '+35% engagement vs formal captions',
    }],
    hashtagStrategies: [{
      platform: 'tiktok',
      strategy: 'Mix broad and niche',
      recommendedCount: 5,
      hashtagTypes: ['trending', 'niche'],
    }],
    timingInsights: [{
      platform: 'tiktok',
      bestDays: ['Tuesday', 'Thursday'],
      bestHours: ['07:00', '12:00', '19:00'],
      timezone: 'EST',
      rationale: 'Peak engagement during commute and lunch hours',
    }],
    recommendations: 'Use hook patterns',
  },
  platformAlgorithmReport: {
    platforms: [{name: 'tiktok', lastUpdated: '2026-03-01', overallStrategy: 'Engagement-first'}],
    algorithmPriorities: [{
      platform: 'tiktok',
      priority: 'Watch time',
      weight: 'critical',
      description: 'Algorithm heavily weighs completion rate',
    }],
    rankingSignals: [{
      platform: 'tiktok',
      signal: 'Completion rate',
      impact: 'strong-positive',
      description: 'Videos watched to completion get wider distribution',
      actionable: true,
    }],
    optimizationStrategies: [{
      platform: 'tiktok',
      strategy: 'Hook-first content',
      description: 'Front-load the hook in first 3 seconds',
      expectedImpact: 'high',
      implementation: 'Start with question, surprising fact, or visual hook',
    }],
    recommendations: 'Prioritize engagement signals',
  },
  brandVoiceConfig: {
    tone: 'professional',
    communicationStyle: 'clear and direct',
    brandPrinciples: ['authenticity', 'empowerment'],
    bannedPhrases: ['guaranteed results'],
    productName: 'WellnessApp',
  },
  platforms: ['tiktok', 'reddit', 'instagram', 'facebook'],
}

const calendarInputs: CalendarInputs = {
  campaignPlan: validCampaignPlan,
  brandVoiceConfig: {
    tone: 'professional',
    communicationStyle: 'clear and direct',
  },
  calendarDuration: '14-day',
}

const optimizerInputs: OptimizerInputs = {
  campaignPlan: validCampaignPlan,
  contentCalendar: validContentCalendar,
  platformAlgorithmReport: {
    platforms: [{name: 'tiktok', lastUpdated: '2026-03-01', overallStrategy: 'Engagement-first'}],
    algorithmPriorities: [{
      platform: 'tiktok',
      priority: 'Watch time',
      weight: 'critical',
      description: 'Algorithm heavily weighs completion rate',
    }],
    rankingSignals: [{
      platform: 'tiktok',
      signal: 'Completion rate',
      impact: 'strong-positive',
      description: 'Videos watched to completion get wider distribution',
      actionable: true,
    }],
    optimizationStrategies: [{
      platform: 'tiktok',
      strategy: 'Hook-first content',
      description: 'Front-load the hook in first 3 seconds',
      expectedImpact: 'high',
      implementation: 'Start with question, surprising fact, or visual hook',
    }],
    recommendations: 'Prioritize engagement signals',
  },
}

describe('runContentStrategist', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated CampaignPlan on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCampaignPlan)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    const result = await runContentStrategist(strategyInputs)

    expect(result.agentName).toBe('content-strategist')
    expect(result.status).toBe('success')
    expect(result.outputs.planId).toBe('plan-2026-03-wellness-spring')
    expect(result.outputs.campaignName).toBe('Spring Wellness Reset Campaign')
    expect(result.outputs.contentThemes).toHaveLength(4)
    expect(result.outputs.contentThemes[0].theme).toBe('Morning Routine Transformation')
    expect(result.outputs.contentThemes[0].platformFit.tiktok).toBe(0.9)
    expect(result.outputs.successMetrics.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.researchInsights.trendSummary).toBeTruthy()
    expect(result.outputs.createdBy).toBe('content-strategist')
  })

  it('throws AgentTimeoutError on error_max_turns', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_turns')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    const {AgentTimeoutError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runContentStrategist(strategyInputs)).rejects.toThrow(AgentTimeoutError)
  })

  it('throws AgentExecutionError on error_during_execution', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runContentStrategist(strategyInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('passes correct tools to query() (WebSearch, WebFetch, Read)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCampaignPlan)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    await runContentStrategist(strategyInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read']),
    )
  })

  it('includes knowledge context in systemPrompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCampaignPlan)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    await runContentStrategist(strategyInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('receives all four research intelligence inputs', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCampaignPlan)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    await runContentStrategist(strategyInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Current Trends')
    expect(callArgs.prompt).toContain('Competitor Analysis')
    expect(callArgs.prompt).toContain('Viral Content Patterns')
    expect(callArgs.prompt).toContain('Platform Algorithm Intelligence')
    expect(callArgs.prompt).toContain('WellnessApp')
    expect(callArgs.prompt).toContain('tiktok, reddit, instagram, facebook')
  })

  it('tracks token usage and cost from SDKResultMessage', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validCampaignPlan)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    const result = await runContentStrategist(strategyInputs)

    expect(result.usage).toBeDefined()
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeTypeOf('number')
  })

  it('throws AgentValidationError when output is invalid (AGENT_OUTPUT_INVALID)', async () => {
    const invalidOutput = {planId: 'test', campaignName: 'ab'} // campaignName too short, missing fields
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runContentStrategist} = await import('../../../src/lib/agents/strategy.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runContentStrategist(strategyInputs)).rejects.toThrow(AgentValidationError)
  })
})

describe('runCampaignPlanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated ContentCalendar on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validContentCalendar)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCampaignPlanner} = await import('../../../src/lib/agents/strategy.js')
    const result = await runCampaignPlanner(calendarInputs)

    expect(result.agentName).toBe('campaign-planner')
    expect(result.status).toBe('success')
    expect(result.outputs.calendarId).toBe('cal-2026-04-wellness')
    expect(result.outputs.campaignId).toBe('plan-2026-03-wellness-spring')
    expect(result.outputs.period.duration).toBe('14-day')
    expect(result.outputs.entries.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.platformBalance).toBeDefined()
    expect(result.outputs.seasonalEvents.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.notes).toBeTruthy()
  })

  it('throws AgentBudgetExceededError on error_max_budget_usd', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_budget_usd')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCampaignPlanner} = await import('../../../src/lib/agents/strategy.js')
    const {AgentBudgetExceededError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runCampaignPlanner(calendarInputs)).rejects.toThrow(AgentBudgetExceededError)
  })

  it('receives campaignPlan from content-strategist output', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validContentCalendar)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCampaignPlanner} = await import('../../../src/lib/agents/strategy.js')
    await runCampaignPlanner(calendarInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Campaign Plan')
    expect(callArgs.prompt).toContain('plan-2026-03-wellness-spring')
    expect(callArgs.prompt).toContain('14-day')
  })

  it('passes correct tools from SKILL.md', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validContentCalendar)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCampaignPlanner} = await import('../../../src/lib/agents/strategy.js')
    await runCampaignPlanner(calendarInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch', 'Read']),
    )
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {calendarId: 'test', entries: 'not an array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runCampaignPlanner} = await import('../../../src/lib/agents/strategy.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runCampaignPlanner(calendarInputs)).rejects.toThrow(AgentValidationError)
  })
})

describe('runChannelOptimizer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated ChannelOptimizationPlan on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validChannelOptimization)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runChannelOptimizer} = await import('../../../src/lib/agents/strategy.js')
    const result = await runChannelOptimizer(optimizerInputs)

    expect(result.agentName).toBe('channel-optimizer')
    expect(result.status).toBe('success')
    expect(result.outputs.planId).toBe('opt-2026-04-wellness')
    expect(result.outputs.campaignId).toBe('plan-2026-03-wellness-spring')
    expect(result.outputs.perPlatformRecommendations.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.seasonalOpportunities.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.crossPlatformStrategies.length).toBeGreaterThanOrEqual(1)
    expect(result.outputs.recommendations).toBeTruthy()
  })

  it('throws AgentExecutionError on error_during_execution', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runChannelOptimizer} = await import('../../../src/lib/agents/strategy.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/index.js')

    await expect(runChannelOptimizer(optimizerInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('receives campaignPlan, contentCalendar, and algorithmReport', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validChannelOptimization)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runChannelOptimizer} = await import('../../../src/lib/agents/strategy.js')
    await runChannelOptimizer(optimizerInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Campaign Plan')
    expect(callArgs.prompt).toContain('Content Calendar')
    expect(callArgs.prompt).toContain('Platform Algorithm Intelligence')
  })

  it('passes correct model (sonnet) from SKILL.md', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validChannelOptimization)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runChannelOptimizer} = await import('../../../src/lib/agents/strategy.js')
    await runChannelOptimizer(optimizerInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('sonnet')
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {planId: 'test', perPlatformRecommendations: 'invalid'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runChannelOptimizer} = await import('../../../src/lib/agents/strategy.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/index.js')

    await expect(runChannelOptimizer(optimizerInputs)).rejects.toThrow(AgentValidationError)
  })
})
