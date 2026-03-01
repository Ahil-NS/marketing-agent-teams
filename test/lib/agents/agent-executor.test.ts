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

describe('executeAgent (backward-compatible wrapper)', () => {
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
  })

  it('delegates to ClaudeAgentExecutor via createAgentExecutor()', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    await executeAgent<TestOutput>('test-agent', baseOptions)

    // The wrapper delegates to ClaudeAgentExecutor which calls query()
    expect(mockQuery).toHaveBeenCalledWith({
      prompt: 'test prompt',
      options: expect.objectContaining({
        systemPrompt: 'test system prompt',
        allowedTools: ['WebSearch'],
        model: 'haiku',
        maxTurns: 5,
        permissionMode: 'bypassPermissions',
      }),
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

  it('throws on max turns exceeded (via ClaudeAgentExecutor)', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_turns')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {MATError} = await import('../../../src/lib/utils/errors.js')

    // After migration, error is AgentTimeoutError from agent-executor/errors.ts
    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(MATError)
    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(/exceeded maximum turns/)
  })

  it('throws on budget exceeded (via ClaudeAgentExecutor)', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_max_budget_usd', 5.0)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {MATError} = await import('../../../src/lib/utils/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(MATError)
    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(/exceeded budget/)
  })

  it('throws on execution error (via ClaudeAgentExecutor)', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {MATError} = await import('../../../src/lib/utils/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(MATError)
    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(/failed during execution/)
  })

  it('throws when no result produced (via ClaudeAgentExecutor)', async () => {
    const mockQuery = createMockQuery([])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {MATError} = await import('../../../src/lib/utils/errors.js')

    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(MATError)
    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(/completed without producing a result/)
  })

  it('wraps SDK errors via ClaudeAgentExecutor', async () => {
    const sdkError = new Error('Network failure')
    const mockQuery = createMockQueryThatThrows(sdkError)
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const {MATError} = await import('../../../src/lib/utils/errors.js')

    // After migration, unknown SDK errors are wrapped in AgentExecutionError (MATError)
    await expect(executeAgent('test-agent', baseOptions)).rejects.toThrow(MATError)
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

  it('preserves executeAgent function signature after migration', async () => {
    const validOutput = {answer: 'test', confidence: 0.8}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')

    // Function should accept same parameters as before migration
    expect(typeof executeAgent).toBe('function')
    const result = await executeAgent<TestOutput>('test-agent', baseOptions)
    expect(result.outputs.answer).toBe('test')
    expect(result.outputs.confidence).toBe(0.8)
  })

  // ── Story 4.6: AI Model Attribution Tracking (FR28) ──────────────────────

  it('includes modelName from SDK response model field', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput, 'claude-haiku-4-2025-04-14')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const result = await executeAgent<TestOutput>('test-agent', baseOptions)

    expect(result.usage.modelName).toBe('claude-haiku-4-2025-04-14')
  })

  it('falls back to options.model when SDK response lacks model field', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const result = await executeAgent<TestOutput>('test-agent', baseOptions)

    expect(result.usage.modelName).toBe('haiku')
  })

  it('sets provider to anthropic', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const result = await executeAgent<TestOutput>('test-agent', baseOptions)

    expect(result.usage.provider).toBe('anthropic')
  })

  it('sets timestamp as a valid ISO 8601 string', async () => {
    const validOutput = {answer: 'hello', confidence: 0.95}
    const mockQuery = createMockQuery([createSuccessMessage(validOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
    const result = await executeAgent<TestOutput>('test-agent', baseOptions)

    expect(result.usage.timestamp).toBeDefined()
    // Validate ISO 8601 format
    const parsed = new Date(result.usage.timestamp)
    expect(parsed.toISOString()).toBe(result.usage.timestamp)
  })
})
