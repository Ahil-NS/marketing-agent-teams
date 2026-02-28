import {describe, it, expect, vi, beforeEach} from 'vitest'
import {z} from 'zod'

import {createSuccessMessage, createErrorMessage, createMockQuery, createMockQueryThatThrows} from '../../helpers/mock-agent-sdk.js'

const testSchema = z.object({
  answer: z.string(),
  confidence: z.number(),
})

type TestOutput = z.infer<typeof testSchema>

const baseOptions = {
  prompt: 'test prompt',
  systemPrompt: 'test system prompt',
  allowedTools: ['WebSearch'],
  model: 'haiku' as const,
  outputSchema: testSchema,
  maxTurns: 5,
}

describe('executeAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns typed AgentResult on success', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const result = await executeAgent<TestOutput>('test-agent', baseOptions)

    expect(result.agentName).toBe('test-agent')
    expect(result.status).toBe('success')
    expect(result.outputs).toEqual(validOutput)
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.errors).toEqual([])

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: 'test prompt',
      options: {
        systemPrompt: 'test system prompt',
        allowedTools: ['WebSearch'],
        model: 'haiku',
        maxTurns: 5,
        permissionMode: 'bypassPermissions',
      },
    })
  })

  it('defaults maxTurns to 15 when not specified', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {maxTurns: _, ...optionsWithoutMaxTurns} = baseOptions
    await executeAgent<TestOutput>('test-agent', optionsWithoutMaxTurns)

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({maxTurns: 15}),
      }),
    )
  })

  it('throws AgentValidationError on invalid output shape', async () => {
    const invalidOutput = {wrong: 'shape'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(AgentValidationError)
  })

  it('throws AgentTimeoutError on max turns exceeded', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_turns')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {AgentTimeoutError} = await import('../../../src/lib/agents/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(AgentTimeoutError)
  })

  it('throws AgentExecutionError on budget exceeded', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_budget_usd', 5.0)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {AgentExecutionError} = await import('../../../src/lib/agents/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentExecutionError on execution error', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {AgentExecutionError} = await import('../../../src/lib/agents/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentExecutionError when no result produced', async () => {
    const mockQuery = createMockQuery([])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {AgentExecutionError} = await import('../../../src/lib/agents/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(AgentExecutionError)
  })

  it('propagates SDK errors as-is when query() throws', async () => {
    const sdkError = new Error('Network failure')
    const mockQuery = createMockQueryThatThrows(sdkError)
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow('Network failure')
  })

  it('throws AgentValidationError when result contains invalid JSON', async () => {
    const mockQuery = createMockQuery([
      {
        type: 'result',
        subtype: 'success',
        result: 'not valid json',
        total_cost_usd: 0.001,
        usage: {input_tokens: 100, output_tokens: 50},
      },
    ])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(AgentValidationError)
  })
})
