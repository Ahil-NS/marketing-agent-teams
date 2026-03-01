import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {HashtagStrategistInputs} from '../../../src/lib/agents/optimization.js'

// --- Valid mock data ---

const validHashtagOutput = [
  {
    contentItemId: 'content-1',
    platformSets: [
      {
        platform: 'instagram',
        hashtags: [
          {tag: 'wellness', reachEstimate: 'high', relevanceScore: 92, competitionLevel: 'high', category: 'evergreen'},
          {tag: 'meditation', reachEstimate: 'high', relevanceScore: 88, competitionLevel: 'medium', category: 'evergreen'},
          {tag: 'mindfulness', reachEstimate: 'medium', relevanceScore: 85, competitionLevel: 'medium', category: 'niche'},
          {tag: 'selfcare', reachEstimate: 'high', relevanceScore: 78, competitionLevel: 'high', category: 'trending'},
          {tag: 'mentalhealth', reachEstimate: 'high', relevanceScore: 75, competitionLevel: 'high', category: 'community'},
        ],
        totalReach: 'high',
        mixBreakdown: {trending: 1, niche: 1, branded: 0, evergreen: 2, community: 1},
      },
    ],
    strategy: 'Focus on evergreen wellness hashtags with community engagement tags',
    avoidedTags: ['#fyp', '#viral'],
  },
]

const overLimitOutput = [
  {
    contentItemId: 'content-2',
    platformSets: [
      {
        platform: 'tiktok',
        hashtags: Array.from({length: 10}, (_, i) => ({
          tag: `tag${i}`,
          reachEstimate: 'medium' as const,
          relevanceScore: 80 - i,
          competitionLevel: 'medium' as const,
          category: 'trending' as const,
        })),
        totalReach: 'medium' as const,
        mixBreakdown: {trending: 10, niche: 0, branded: 0, evergreen: 0, community: 0},
      },
    ],
    strategy: 'Testing over-limit scenario',
    avoidedTags: [],
  },
]

const testInputs: HashtagStrategistInputs = {
  contentItems: [
    {
      id: 'content-1',
      contentText: 'Discover the power of daily meditation for stress relief and productivity.',
      platform: 'instagram',
      topic: 'meditation and wellness',
      keywords: ['meditation', 'wellness', 'stress relief'],
    },
  ],
  brandName: 'ZenFlow',
  industryVertical: 'health-wellness',
}

describe('runHashtagStrategist', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('calls executeAgent with model haiku', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHashtagOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHashtagStrategist} = await import('../../../src/lib/agents/optimization.js')
    await runHashtagStrategist(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('haiku')
  })

  it('calls executeAgent with allowedTools [Read, WebSearch]', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHashtagOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHashtagStrategist} = await import('../../../src/lib/agents/optimization.js')
    await runHashtagStrategist(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'WebSearch']),
    )
  })

  it('passes content items in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHashtagOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHashtagStrategist} = await import('../../../src/lib/agents/optimization.js')
    await runHashtagStrategist(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('content-1')
    expect(callArgs.prompt).toContain('meditation and wellness')
    expect(callArgs.prompt).toContain('ZenFlow')
    expect(callArgs.prompt).toContain('health-wellness')
  })

  it('injects platform hashtag limits into prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHashtagOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHashtagStrategist} = await import('../../../src/lib/agents/optimization.js')
    await runHashtagStrategist(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('TikTok: 5 recommended (max 8)')
    expect(callArgs.prompt).toContain('Instagram: 15 recommended (max 30)')
    expect(callArgs.prompt).toContain('Facebook: 3 recommended (max 10)')
    expect(callArgs.prompt).toContain('Reddit: No hashtags')
  })

  it('returns validated output', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(validHashtagOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHashtagStrategist} = await import('../../../src/lib/agents/optimization.js')
    const result = await runHashtagStrategist(testInputs)

    expect(result.agentName).toBe('hashtag-strategist')
    expect(result.status).toBe('success')
    expect(result.outputs).toHaveLength(1)
    expect(result.outputs[0].contentItemId).toBe('content-1')
    expect(result.outputs[0].platformSets[0].platform).toBe('instagram')
    expect(result.outputs[0].platformSets[0].hashtags).toHaveLength(5)
  })

  it('throws error on agent failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runHashtagStrategist} = await import('../../../src/lib/agents/optimization.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runHashtagStrategist(testInputs)).rejects.toThrow(AgentExecutionError)
  })
})

describe('validateHashtagCounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns warnings for over-limit sets', async () => {
    // Need dynamic import to get the function
    const {validateHashtagCounts} = await import('../../../src/lib/agents/optimization.js')
    const {PLATFORM_HASHTAG_LIMITS} = await import('../../../src/lib/agents/hashtag-config.js')

    const warnings = validateHashtagCounts(overLimitOutput[0], PLATFORM_HASHTAG_LIMITS)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('tiktok')
    expect(warnings[0]).toContain('exceeds max')
  })

  it('returns empty array for compliant sets', async () => {
    const {validateHashtagCounts} = await import('../../../src/lib/agents/optimization.js')
    const {PLATFORM_HASHTAG_LIMITS} = await import('../../../src/lib/agents/hashtag-config.js')

    const warnings = validateHashtagCounts(validHashtagOutput[0], PLATFORM_HASHTAG_LIMITS)
    expect(warnings).toEqual([])
  })

  it('returns warning for below-min hashtag count', async () => {
    const {validateHashtagCounts} = await import('../../../src/lib/agents/optimization.js')
    const {PLATFORM_HASHTAG_LIMITS} = await import('../../../src/lib/agents/hashtag-config.js')

    const underLimit = {
      contentItemId: 'content-3',
      platformSets: [
        {
          platform: 'instagram' as const,
          hashtags: [
            {tag: 'test', reachEstimate: 'low' as const, relevanceScore: 50, competitionLevel: 'low' as const, category: 'niche' as const},
          ],
          totalReach: 'low' as const,
          mixBreakdown: {trending: 0, niche: 1, branded: 0, evergreen: 0, community: 0},
        },
      ],
      strategy: 'Minimal test',
      avoidedTags: [],
    }

    const warnings = validateHashtagCounts(underLimit, PLATFORM_HASHTAG_LIMITS)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('instagram')
    expect(warnings[0]).toContain('below min')
  })

  it('returns warning for unknown platform', async () => {
    const {validateHashtagCounts} = await import('../../../src/lib/agents/optimization.js')
    const {PLATFORM_HASHTAG_LIMITS} = await import('../../../src/lib/agents/hashtag-config.js')

    const unknownPlatform = {
      contentItemId: 'content-4',
      platformSets: [
        {
          platform: 'youtube' as const,
          hashtags: [],
          totalReach: 'low' as const,
          mixBreakdown: {trending: 0, niche: 0, branded: 0, evergreen: 0, community: 0},
        },
      ],
      strategy: 'Test unknown',
      avoidedTags: [],
    }

    // Need to cast because the schema wouldn't allow 'youtube' but we're testing runtime behavior
    const warnings = validateHashtagCounts(unknownPlatform as any, PLATFORM_HASHTAG_LIMITS)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('Unknown platform')
  })
})
