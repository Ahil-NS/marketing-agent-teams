import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {AbTestOutput} from '../../../src/lib/schemas/optimization-schema.js'
import type {AbTestInputs} from '../../../src/lib/agents/optimization.js'

// --- Load fixture ---

const fixtureOutput: AbTestOutput = JSON.parse(
  readFileSync(join(__dirname, '../../fixtures/responses/claude-ab-test-designer.json'), 'utf-8'),
)

// --- Test inputs ---

const testInputs: AbTestInputs = {
  contentItems: [
    {id: 'content-1', platform: 'reddit', content: 'Test content about marketing frameworks'},
  ],
  brandVoiceTone: 'professional',
  brandVoiceStyle: 'clear and direct',
}

describe('runAbTestDesigner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid AbTestOutput on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    const result = await runAbTestDesigner(testInputs)

    expect(result.agentName).toBe('ab-test-designer')
    expect(result.status).toBe('success')
    expect(result.outputs.testPlans).toHaveLength(3)
    expect(result.outputs.variations).toHaveLength(5)
    expect(result.outputs.recommendations.primaryTestId).toBe('test-hook-content-1')
    expect(result.outputs.summary.totalVariations).toBe(5)
    expect(result.outputs.summary.contentItemsCovered).toBe(1)
  })

  it('generates 3-5 variations per content item', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    const result = await runAbTestDesigner(testInputs)

    // Count variations per original content item
    const variationsPerItem = new Map<string, number>()
    for (const v of result.outputs.variations) {
      variationsPerItem.set(v.originalContentItemId, (variationsPerItem.get(v.originalContentItemId) ?? 0) + 1)
    }

    // Each content item should have 3-5 variations
    for (const [, count] of variationsPerItem) {
      expect(count).toBeGreaterThanOrEqual(3)
      expect(count).toBeLessThanOrEqual(5)
    }
  })

  it('each variation links to original content item via originalContentItemId', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    const result = await runAbTestDesigner(testInputs)

    const inputIds = new Set(testInputs.contentItems.map(i => i.id))
    for (const variation of result.outputs.variations) {
      expect(inputIds.has(variation.originalContentItemId)).toBe(true)
    }
  })

  it('each variation has variationType and variationDescription', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    const result = await runAbTestDesigner(testInputs)

    const validTypes = new Set(['hook', 'caption', 'hashtag', 'format', 'cta'])
    for (const variation of result.outputs.variations) {
      expect(validTypes.has(variation.variationType)).toBe(true)
      expect(variation.variationDescription.length).toBeGreaterThan(0)
    }
  })

  it('passes correct tools [Read] to executeAgent', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    await runAbTestDesigner(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(['Read'])
  })

  it('uses model haiku from skill definition', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    await runAbTestDesigner(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('haiku')
  })

  it('includes content items and brand voice in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    await runAbTestDesigner(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('content-1')
    expect(callArgs.prompt).toContain('professional')
    expect(callArgs.prompt).toContain('clear and direct')
    expect(callArgs.prompt).toContain('3-5 variations')
  })

  it('throws AgentExecutionError on agent failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runAbTestDesigner(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {testPlans: [], variations: [], recommendations: {}, summary: {}}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runAbTestDesigner(testInputs)).rejects.toThrow(AgentValidationError)
  })

  it('includes knowledge context in system prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixtureOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runAbTestDesigner} = await import('../../../src/lib/agents/optimization.js')
    await runAbTestDesigner(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })
})
