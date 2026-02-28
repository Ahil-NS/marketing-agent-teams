import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {ResearchInputs} from '../../../src/lib/agents/types.js'

const validTrendBrief = {
  trends: [
    {
      name: 'Short-form video',
      description: 'Brands using short videos see higher engagement',
      relevance: 0.9,
      source: 'https://example.com',
    },
  ],
  viralPatterns: [
    {
      pattern: 'Hook-in-first-3-seconds',
      platform: 'tiktok',
      examples: ['Wait for it...'],
    },
  ],
  opportunities: [
    {
      description: 'Create behind-the-scenes content',
      platform: 'tiktok',
      priority: 'high' as const,
    },
  ],
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

    expect(result.trends).toHaveLength(1)
    expect(result.trends[0].name).toBe('Short-form video')
    expect(result.trends[0].relevance).toBe(0.9)
    expect(result.viralPatterns).toHaveLength(1)
    expect(result.viralPatterns[0].platform).toBe('tiktok')
    expect(result.opportunities).toHaveLength(1)
    expect(result.opportunities[0].priority).toBe('high')

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          allowedTools: ['WebSearch', 'WebFetch'],
          model: 'haiku',
        }),
      }),
    )
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
})
