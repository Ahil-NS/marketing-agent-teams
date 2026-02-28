import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery, createMockQueryThatThrows} from '../../helpers/mock-agent-sdk.js'
import type {AgentExecuteOptions} from '../../../src/lib/agent-executor/types.js'

const baseOptions: AgentExecuteOptions = {
  agentName: 'test-agent',
  skillMd: '# Test Agent\nYou are a test agent.',
  input: {prompt: 'Analyze the market trends'},
  model: 'haiku',
  allowedTools: ['WebSearch'],
  budget: {maxCostUsd: 1.0, maxTurns: 10},
}

describe('ClaudeAgentExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('execute()', () => {
    it('yields AgentMessage on success', async () => {
      const mockQuery = createMockQuery([
        createSuccessMessage({answer: 'market is growing'}),
      ])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const messages = []
      for await (const msg of executor.execute(baseOptions)) {
        messages.push(msg)
      }

      expect(messages).toHaveLength(1)
      expect(messages[0].type).toBe('result')
      expect(messages[0].subtype).toBe('success')
      expect(messages[0].result).toBe(JSON.stringify({answer: 'market is growing'}))
      expect(messages[0].totalCostUsd).toBe(0.0025)
      expect(messages[0].usage).toEqual({inputTokens: 450, outputTokens: 380})
      expect(messages[0].numTurns).toBe(3)
      expect(messages[0].durationMs).toBe(4500)
    })

    it('passes correct options to SDK query()', async () => {
      const mockQuery = createMockQuery([createSuccessMessage({ok: true})])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      for await (const _msg of executor.execute(baseOptions)) {
        // consume
      }

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Analyze the market trends',
        options: {
          systemPrompt: '# Test Agent\nYou are a test agent.',
          allowedTools: ['WebSearch'],
          model: 'haiku',
          maxTurns: 10,
          permissionMode: 'bypassPermissions',
          maxBudgetUsd: 1.0,
        },
      })
    })

    it('defaults model to sonnet when not specified', async () => {
      const mockQuery = createMockQuery([createSuccessMessage({ok: true})])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const {model: _, ...optionsWithoutModel} = baseOptions
      for await (const _msg of executor.execute(optionsWithoutModel)) {
        // consume
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({model: 'sonnet'}),
        }),
      )
    })

    it('defaults maxTurns to 15 when budget not provided', async () => {
      const mockQuery = createMockQuery([createSuccessMessage({ok: true})])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const {budget: _, ...optionsWithoutBudget} = baseOptions
      for await (const _msg of executor.execute(optionsWithoutBudget)) {
        // consume
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({maxTurns: 15}),
        }),
      )
    })

    it('does not send maxBudgetUsd when budget not set', async () => {
      const mockQuery = createMockQuery([createSuccessMessage({ok: true})])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const {budget: _, ...optionsWithoutBudget} = baseOptions
      for await (const _msg of executor.execute(optionsWithoutBudget)) {
        // consume
      }

      const calledOptions = mockQuery.mock.calls[0][0].options
      expect(calledOptions).not.toHaveProperty('maxBudgetUsd')
    })

    it('defaults allowedTools to empty array when not specified', async () => {
      const mockQuery = createMockQuery([createSuccessMessage({ok: true})])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const {allowedTools: _, ...optionsWithoutTools} = baseOptions
      for await (const _msg of executor.execute(optionsWithoutTools)) {
        // consume
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({allowedTools: []}),
        }),
      )
    })

    it('throws AgentTimeoutError on error_max_turns', async () => {
      const mockQuery = createMockQuery([createErrorMessage('error_max_turns')])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentTimeoutError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentTimeoutError)
      await expect(consume()).rejects.toThrow(/exceeded maximum turns/)
    })

    it('throws AgentBudgetExceededError on error_max_budget_usd', async () => {
      const mockQuery = createMockQuery([createErrorMessage('error_max_budget_usd', 5.0)])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentBudgetExceededError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentBudgetExceededError)
      await expect(consume()).rejects.toThrow(/exceeded budget/)
    })

    it('throws AgentExecutionError on error_during_execution', async () => {
      const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentExecutionError)
      await expect(consume()).rejects.toThrow(/failed during execution/)
    })

    it('throws AgentNoResultError when no result message emitted', async () => {
      const mockQuery = createMockQuery([])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentNoResultError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentNoResultError)
      await expect(consume()).rejects.toThrow(/completed without producing a result/)
    })

    it('throws AgentAuthError on auth-related SDK errors', async () => {
      const mockQuery = createMockQueryThatThrows(new Error('authentication failed: token expired'))
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentAuthError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentAuthError)
    })

    it('throws AgentAuthError on unauthorized SDK errors', async () => {
      const mockQuery = createMockQueryThatThrows(new Error('unauthorized access'))
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentAuthError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentAuthError)
    })

    it('wraps unknown SDK errors in AgentExecutionError', async () => {
      const mockQuery = createMockQueryThatThrows(new Error('Network failure'))
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentExecutionError)
      await expect(consume()).rejects.toThrow(/Network failure/)
    })

    it('wraps non-Error throws in AgentExecutionError', async () => {
      const mockQuery = vi.fn(() => {
        throw 'string error'
      })
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      await expect(consume()).rejects.toThrow(AgentExecutionError)
    })

    it('re-throws AgentTimeoutError without wrapping', async () => {
      // The error is thrown inside the for-await loop, so it should be re-thrown as-is
      const mockQuery = createMockQuery([createErrorMessage('error_max_turns')])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentTimeoutError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      const consume = async () => {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
      }

      try {
        await consume()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AgentTimeoutError)
        expect((error as AgentTimeoutError).code).toBe('AGENT_TIMEOUT')
      }
    })

    it('includes budget info in AgentBudgetExceededError', async () => {
      const mockQuery = createMockQuery([createErrorMessage('error_max_budget_usd', 5.0)])
      vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const {AgentBudgetExceededError} = await import('../../../src/lib/agent-executor/errors.js')
      const executor = new ClaudeAgentExecutor()

      try {
        for await (const _msg of executor.execute(baseOptions)) {
          // consume
        }
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AgentBudgetExceededError)
        expect((error as AgentBudgetExceededError).code).toBe('AGENT_BUDGET_EXCEEDED')
        expect((error as AgentBudgetExceededError).reason).toContain('$1')
      }
    })
  })

  describe('estimateCost()', () => {
    it('estimates cost for haiku model', async () => {
      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const estimate = executor.estimateCost('haiku', 1_000_000)

      expect(estimate.model).toBe('haiku')
      expect(estimate.inputPricePerMillion).toBe(0.25)
      expect(estimate.outputPricePerMillion).toBe(1.25)
      // 1M input * 0.25/M + 250K output * 1.25/M = 0.25 + 0.3125 = 0.5625
      expect(estimate.estimatedCostUsd).toBeCloseTo(0.5625, 4)
    })

    it('estimates cost for sonnet model', async () => {
      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const estimate = executor.estimateCost('sonnet', 1_000_000)

      expect(estimate.model).toBe('sonnet')
      expect(estimate.inputPricePerMillion).toBe(3.0)
      expect(estimate.outputPricePerMillion).toBe(15.0)
      // 1M input * 3/M + 250K output * 15/M = 3.0 + 3.75 = 6.75
      expect(estimate.estimatedCostUsd).toBeCloseTo(6.75, 4)
    })

    it('falls back to sonnet pricing for unknown model', async () => {
      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const estimate = executor.estimateCost('unknown-model', 1_000_000)

      expect(estimate.inputPricePerMillion).toBe(3.0)
      expect(estimate.outputPricePerMillion).toBe(15.0)
    })

    it('estimates output tokens at 25% of input tokens', async () => {
      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const estimate = executor.estimateCost('haiku', 5000)

      // 5000 input * 0.25/1M + 1250 output * 1.25/1M
      const expectedCost = (5000 / 1_000_000) * 0.25 + (1250 / 1_000_000) * 1.25
      expect(estimate.estimatedCostUsd).toBeCloseTo(expectedCost, 6)
    })

    it('returns model name in estimate', async () => {
      const {ClaudeAgentExecutor} = await import('../../../src/lib/agent-executor/claude-agent-executor.js')
      const executor = new ClaudeAgentExecutor()

      const estimate = executor.estimateCost('haiku', 1000)
      expect(estimate.model).toBe('haiku')
    })
  })
})
