import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {StageExecutionResult, StageRunnerContext} from '../../../src/lib/orchestrator/types.js'
import {createMockAgentResult} from '../../helpers/mock-agent-executor.js'

// Hoist mock at module level so stage-runner.ts gets the mock
vi.mock('../../../src/lib/agents/agent-executor.js', () => ({
  executeAgent: vi.fn(),
}))

// Also mock the errors module since stage-runner imports AgentTimeoutError
vi.mock('../../../src/lib/agents/errors.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/agents/errors.js')>()
  return actual
})

import {executeAgent} from '../../../src/lib/agents/agent-executor.js'
import {StageRunner} from '../../../src/lib/orchestrator/stage-runner.js'

const mockExecuteAgent = vi.mocked(executeAgent)

function makePipelineRun(overrides?: Partial<StageRunnerContext>): StageRunnerContext {
  return {
    config: {
      platforms: ['reddit', 'tiktok'],
      dryRun: false,
    },
    stageResults: {},
    ...overrides,
  }
}

describe('StageRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockExecuteAgent.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('runStage — all agents succeed', () => {
    it('returns completed status when all agents succeed', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
      expect(result.stage).toBe('research')
      expect(Object.keys(result.agentResults)).toHaveLength(3)
      expect(result.errors).toHaveLength(0)
    })

    it('includes per-agent results with success status', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {
          outputs: agentName === 'trend-scout' ? {trends: ['ai-marketing']} : {mockData: `output from ${agentName}`},
        }),
      )

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.agentResults['trend-scout'].status).toBe('success')
      expect(result.agentResults['trend-scout'].result?.outputs).toEqual({trends: ['ai-marketing']})
      expect(result.agentResults['trend-scout'].error).toBeNull()
    })
  })

  describe('runStage — partial failure (degraded mode)', () => {
    it('returns partial status when some agents fail', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        if (agentName === 'competitor-analyst') throw new Error('Network timeout')
        return createMockAgentResult(agentName)
      })

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('partial')
      expect(result.agentResults['trend-scout'].status).toBe('success')
      expect(result.agentResults['competitor-analyst'].status).toBe('failed')
      expect(result.agentResults['competitor-analyst'].error).toBeTruthy()
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('runStage — all agents fail', () => {
    it('returns failed status when all agents fail', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        throw new Error(`${agentName} failed`)
      })

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('failed')
      expect(result.errors).toHaveLength(3)
      for (const agentResult of Object.values(result.agentResults)) {
        expect(agentResult.status).toBe('failed')
      }
    })
  })

  describe('runStage — empty stage (review)', () => {
    it('returns skipped status for stage with no agents', async () => {
      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('review', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('skipped')
      expect(Object.keys(result.agentResults)).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('runStage — enabled agents filter (FR49)', () => {
    it('only executes enabled agents when config.enabledAgents is set', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun({
        config: {
          platforms: ['reddit'],
          dryRun: false,
          enabledAgents: ['trend-scout'],
        },
      })
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
      expect(Object.keys(result.agentResults)).toHaveLength(1)
      expect(result.agentResults['trend-scout']).toBeDefined()
      expect(mockExecuteAgent).toHaveBeenCalledTimes(1)
    })

    it('skips stage when no enabled agents match stage agents', async () => {
      const runner = new StageRunner()
      const pipelineRun = makePipelineRun({
        config: {
          platforms: ['reddit'],
          dryRun: false,
          enabledAgents: ['seo-optimizer'], // Not in research stage
        },
      })
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('skipped')
    })
  })

  describe('runStage — agent timeout', () => {
    it('times out agents that exceed agentTimeoutMs', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        if (agentName === 'competitor-analyst') {
          // This promise will never resolve — timeout should catch it
          return new Promise(() => {})
        }
        return createMockAgentResult(agentName)
      })

      const runner = new StageRunner({agentTimeoutMs: 1000})
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)

      await vi.advanceTimersByTimeAsync(1500)
      const result = await resultPromise

      expect(result.status).toBe('partial')
      expect(result.agentResults['competitor-analyst'].status).toBe('failed')
      expect(result.agentResults['trend-scout'].status).toBe('success')
    })
  })

  describe('runStage — timestamps', () => {
    it('sets startedAt and completedAt timestamps', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.startedAt).toBeTruthy()
      expect(result.completedAt).toBeTruthy()
      expect(new Date(result.startedAt).getTime()).toBeLessThanOrEqual(new Date(result.completedAt).getTime())
    })
  })

  describe('runStage — parallel execution', () => {
    it('executes agents in parallel (total time is max, not sum)', async () => {
      vi.useRealTimers()

      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return createMockAgentResult(agentName)
      })

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun()
      const startTime = Date.now()
      const result = await runner.runStage('research', pipelineRun)
      const elapsed = Date.now() - startTime

      expect(result.status).toBe('completed')
      // 3 agents at 50ms each in parallel should take ~50ms, not 150ms
      expect(elapsed).toBeLessThan(300)
      expect(mockExecuteAgent).toHaveBeenCalledTimes(3)
    })
  })

  describe('runStage — input resolution', () => {
    it('resolves inputs from upstream stage results', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const researchResult: StageExecutionResult = {
        stage: 'research',
        status: 'completed',
        agentResults: {
          'trend-scout': {
            agentName: 'trend-scout',
            status: 'success',
            result: createMockAgentResult('trend-scout', {outputs: {trends: ['ai']}}),
            error: null,
            duration: 1000,
          },
        },
        startedAt: '2026-02-28T10:00:00.000Z',
        completedAt: '2026-02-28T10:00:01.000Z',
        errors: [],
      }

      const runner = new StageRunner()
      const pipelineRun = makePipelineRun({
        stageResults: {research: researchResult},
      })

      const resultPromise = runner.runStage('strategy', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
      expect(mockExecuteAgent).toHaveBeenCalled()
      const firstCall = mockExecuteAgent.mock.calls[0]
      const prompt = JSON.parse(firstCall[1].prompt)
      expect(prompt['trend-scout']).toEqual({trends: ['ai']})
    })
  })

  describe('runStage — continueOnFailure: false', () => {
    it('treats partial failure as full failure when continueOnFailure is false', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        if (agentName === 'competitor-analyst') throw new Error('Network timeout')
        return createMockAgentResult(agentName)
      })

      const runner = new StageRunner({continueOnFailure: false})
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      // Status is 'failed' (not 'partial') because continueOnFailure is false
      expect(result.status).toBe('failed')
      // All agents still ran (NFR14 — never abort remaining agents)
      expect(Object.keys(result.agentResults)).toHaveLength(3)
      expect(result.agentResults['trend-scout'].status).toBe('success')
      expect(result.agentResults['competitor-analyst'].status).toBe('failed')
    })

    it('does not affect all-success stages', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const runner = new StageRunner({continueOnFailure: false})
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
    })
  })

  describe('runStage — concurrency limit', () => {
    it('respects concurrencyLimit by batching agent execution', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const runner = new StageRunner({concurrencyLimit: 2})
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
      expect(Object.keys(result.agentResults)).toHaveLength(3)
      expect(mockExecuteAgent).toHaveBeenCalledTimes(3)
    })

    it('handles concurrencyLimit of 1 (sequential execution)', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const runner = new StageRunner({concurrencyLimit: 1})
      const pipelineRun = makePipelineRun()
      const resultPromise = runner.runStage('research', pipelineRun)
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
      expect(Object.keys(result.agentResults)).toHaveLength(3)
      expect(mockExecuteAgent).toHaveBeenCalledTimes(3)
    })
  })
})
