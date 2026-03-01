import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {FactCheckerInputs} from '../../../src/lib/agents/quality.js'

import fixture from '../../fixtures/responses/claude-fact-checker.json'

const testInputs: FactCheckerInputs = {
  contentItems: [
    {
      id: 'item-001',
      contentText: '90% of users report improved productivity. Founded in 1998.',
      platform: 'reddit',
      topic: 'productivity tools',
    },
  ],
}

describe('runFactChecker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated fact check reports', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFactChecker} = await import('../../../src/lib/agents/quality.js')
    const result = await runFactChecker(testInputs)

    expect(result).toHaveLength(1)
    expect(result[0].contentItemId).toBe('item-001')
    expect(result[0].claimsFound).toBe(2)
    expect(result[0].verdicts).toHaveLength(2)
    expect(result[0].overallAccuracy).toBe(82)
    expect(result[0].recommendation).toBe('pass')
  })

  it('calls executeAgent with model haiku', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFactChecker} = await import('../../../src/lib/agents/quality.js')
    await runFactChecker(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('haiku')
  })

  it('calls executeAgent with allowedTools Read and WebSearch', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFactChecker} = await import('../../../src/lib/agents/quality.js')
    await runFactChecker(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(['Read', 'WebSearch'])
  })

  it('passes content items in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFactChecker} = await import('../../../src/lib/agents/quality.js')
    await runFactChecker(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('item-001')
    expect(callArgs.prompt).toContain('90% of users report improved productivity')
    expect(callArgs.prompt).toContain('reddit')
    expect(callArgs.prompt).toContain('productivity tools')
  })

  it('uses maxTurns 20', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runFactChecker} = await import('../../../src/lib/agents/quality.js')
    await runFactChecker(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {maxTurns: number}}
    expect(callArgs.options.maxTurns).toBe(20)
  })
})
