import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {SensitivityReviewerInputs} from '../../../src/lib/agents/quality.js'

import fixture from '../../fixtures/responses/claude-sensitivity-reviewer.json'

const testInputs: SensitivityReviewerInputs = {
  contentItems: [
    {
      id: 'item-001',
      contentText: 'This product is a lifesaver for stressed moms. Even your grandma can use it!',
      platform: 'instagram',
      targetAudience: 'parents aged 25-45',
      region: 'US',
    },
  ],
}

describe('runSensitivityReviewer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns validated sensitivity reports', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSensitivityReviewer} = await import('../../../src/lib/agents/quality.js')
    const result = await runSensitivityReviewer(testInputs)

    expect(result).toHaveLength(1)
    expect(result[0].contentItemId).toBe('item-001')
    expect(result[0].flags).toHaveLength(2)
    expect(result[0].overallSeverity).toBe('medium')
    expect(result[0].recommendation).toBe('needs-revision')
  })

  it('calls executeAgent with model sonnet', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSensitivityReviewer} = await import('../../../src/lib/agents/quality.js')
    await runSensitivityReviewer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('sonnet')
  })

  it('calls executeAgent with allowedTools Read only', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSensitivityReviewer} = await import('../../../src/lib/agents/quality.js')
    await runSensitivityReviewer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(['Read'])
  })

  it('passes content items and audience context in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSensitivityReviewer} = await import('../../../src/lib/agents/quality.js')
    await runSensitivityReviewer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('item-001')
    expect(callArgs.prompt).toContain('This product is a lifesaver for stressed moms')
    expect(callArgs.prompt).toContain('instagram')
    expect(callArgs.prompt).toContain('parents aged 25-45')
    expect(callArgs.prompt).toContain('US')
  })

  it('uses maxTurns 15', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runSensitivityReviewer} = await import('../../../src/lib/agents/quality.js')
    await runSensitivityReviewer(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {maxTurns: number}}
    expect(callArgs.options.maxTurns).toBe(15)
  })
})
