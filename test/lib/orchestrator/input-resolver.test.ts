import {beforeAll, describe, expect, it} from 'vitest'

import {StageInputResolutionError} from '../../../src/lib/orchestrator/errors.js'
import type {PipelineStage, StageExecutionResult} from '../../../src/lib/orchestrator/types.js'

function makeStageResult(
  stage: PipelineStage,
  overrides?: Partial<StageExecutionResult>,
): StageExecutionResult {
  return {
    stage,
    status: 'completed',
    agentResults: {},
    startedAt: '2026-02-28T10:00:00.000Z',
    completedAt: '2026-02-28T10:00:04.000Z',
    errors: [],
    ...overrides,
  }
}

describe('resolveInputs', () => {
  let resolveInputs: typeof import('../../../src/lib/orchestrator/input-resolver.js').resolveInputs

  beforeAll(async () => {
    const mod = await import('../../../src/lib/orchestrator/input-resolver.js')
    resolveInputs = mod.resolveInputs
  })

  it('returns empty object for research stage (no upstream dependencies)', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {}
    const result = resolveInputs('research', stageResults)
    expect(result).toEqual({})
  })

  it('returns empty object for distribution stage (no upstream dependencies)', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {}
    const result = resolveInputs('distribution', stageResults)
    expect(result).toEqual({})
  })

  it('resolves strategy inputs from completed research stage', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {
      research: makeStageResult('research', {
        agentResults: {
          'trend-scout': {
            agentName: 'trend-scout',
            status: 'success',
            result: {
              agentName: 'trend-scout',
              status: 'success',
              outputs: {trends: ['trend1'], viralPatterns: []},
              usage: {inputTokens: 500, outputTokens: 200, cost: 0.003},
              duration: 4200,
              errors: [],
            },
            error: null,
            duration: 4200,
          },
          'audience-researcher': {
            agentName: 'audience-researcher',
            status: 'success',
            result: {
              agentName: 'audience-researcher',
              status: 'success',
              outputs: {segments: ['young-adults']},
              usage: {inputTokens: 400, outputTokens: 150, cost: 0.002},
              duration: 3800,
              errors: [],
            },
            error: null,
            duration: 3800,
          },
        },
      }),
    }

    const result = resolveInputs('strategy', stageResults)
    expect(result['trend-scout']).toEqual({trends: ['trend1'], viralPatterns: []})
    expect(result['audience-researcher']).toEqual({segments: ['young-adults']})
  })

  it('handles degraded mode — failed agent outputs are null', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {
      research: makeStageResult('research', {
        status: 'partial',
        agentResults: {
          'trend-scout': {
            agentName: 'trend-scout',
            status: 'success',
            result: {
              agentName: 'trend-scout',
              status: 'success',
              outputs: {trends: ['trend1']},
              usage: {inputTokens: 500, outputTokens: 200, cost: 0.003},
              duration: 4200,
              errors: [],
            },
            error: null,
            duration: 4200,
          },
          'competitor-analyst': {
            agentName: 'competitor-analyst',
            status: 'failed',
            result: null,
            error: new Error('Agent timed out') as any,
            duration: 0,
          },
        },
      }),
    }

    const result = resolveInputs('strategy', stageResults)
    expect(result['trend-scout']).toEqual({trends: ['trend1']})
    expect(result['competitor-analyst']).toBeNull()
  })

  it('throws StageInputResolutionError when required upstream has not executed', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {}

    expect(() => resolveInputs('strategy', stageResults)).toThrow(StageInputResolutionError)
  })

  it('throws StageInputResolutionError when upstream stage is still pending', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {
      research: makeStageResult('research', {status: 'pending'}),
    }

    expect(() => resolveInputs('strategy', stageResults)).toThrow(StageInputResolutionError)
  })

  it('resolves creation inputs from both research and strategy stages', () => {
    const stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {
      research: makeStageResult('research', {
        agentResults: {
          'trend-scout': {
            agentName: 'trend-scout',
            status: 'success',
            result: {
              agentName: 'trend-scout',
              status: 'success',
              outputs: {trends: ['trend1']},
              usage: {inputTokens: 500, outputTokens: 200, cost: 0.003},
              duration: 4200,
              errors: [],
            },
            error: null,
            duration: 4200,
          },
        },
      }),
      strategy: makeStageResult('strategy', {
        agentResults: {
          'content-strategist': {
            agentName: 'content-strategist',
            status: 'success',
            result: {
              agentName: 'content-strategist',
              status: 'success',
              outputs: {strategy: {theme: 'growth'}},
              usage: {inputTokens: 300, outputTokens: 100, cost: 0.001},
              duration: 2000,
              errors: [],
            },
            error: null,
            duration: 2000,
          },
        },
      }),
    }

    const result = resolveInputs('creation', stageResults)
    expect(result['trend-scout']).toEqual({trends: ['trend1']})
    expect(result['content-strategist']).toEqual({strategy: {theme: 'growth'}})
  })

  it('includes the stage name in the error message', () => {
    try {
      resolveInputs('strategy', {})
      expect.fail('Should have thrown')
    } catch (error) {
      expect((error as StageInputResolutionError).message).toContain('strategy')
      expect((error as StageInputResolutionError).message).toContain('research')
    }
  })
})
