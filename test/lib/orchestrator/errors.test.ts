import {describe, expect, it} from 'vitest'

import {MATError} from '../../../src/lib/utils/errors.js'

describe('orchestrator/errors', () => {
  describe('StageExecutionError', () => {
    it('extends MATError', async () => {
      const {StageExecutionError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new StageExecutionError(
        'All agents failed in research stage',
        'STAGE_ALL_AGENTS_FAILED',
        'Every agent in the research stage threw an error',
        'Check agent configurations and API connectivity. Retry the stage.',
        'orchestrator/stage-runner',
        'transient',
      )
      expect(error).toBeInstanceOf(MATError)
      expect(error).toBeInstanceOf(Error)
    })

    it('sets all properties correctly', async () => {
      const {StageExecutionError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new StageExecutionError(
        'All agents failed',
        'STAGE_ALL_AGENTS_FAILED',
        'Every agent threw',
        'Retry the stage',
        'orchestrator/stage-runner',
        'transient',
      )
      expect(error.message).toBe('All agents failed')
      expect(error.code).toBe('STAGE_ALL_AGENTS_FAILED')
      expect(error.reason).toBe('Every agent threw')
      expect(error.resolution).toBe('Retry the stage')
      expect(error.source).toBe('orchestrator/stage-runner')
      expect(error.severity).toBe('transient')
      expect(error.name).toBe('StageExecutionError')
    })
  })

  describe('StagePartialFailureError', () => {
    it('extends MATError', async () => {
      const {StagePartialFailureError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new StagePartialFailureError(
        'Some agents failed in research stage',
        'STAGE_PARTIAL_FAILURE',
        '1 of 3 agents failed',
        'Pipeline continues in degraded mode',
        'orchestrator/stage-runner',
        'transient',
        ['competitor-analyst'],
        ['trend-scout', 'audience-researcher'],
      )
      expect(error).toBeInstanceOf(MATError)
    })

    it('includes failedAgents and succeededAgents arrays', async () => {
      const {StagePartialFailureError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new StagePartialFailureError(
        'Some agents failed',
        'STAGE_PARTIAL_FAILURE',
        'Partial failure',
        'Degraded mode',
        'orchestrator/stage-runner',
        'transient',
        ['competitor-analyst'],
        ['trend-scout', 'audience-researcher'],
      )
      expect(error.failedAgents).toEqual(['competitor-analyst'])
      expect(error.succeededAgents).toEqual(['trend-scout', 'audience-researcher'])
      expect(error.name).toBe('StagePartialFailureError')
    })
  })

  describe('StageInputResolutionError', () => {
    it('extends MATError', async () => {
      const {StageInputResolutionError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new StageInputResolutionError(
        'Cannot resolve inputs for strategy stage',
        'STAGE_INPUT_MISSING',
        'Research stage has not executed yet',
        'Run stages in order: research -> strategy -> creation',
        'orchestrator/input-resolver',
        'permanent',
      )
      expect(error).toBeInstanceOf(MATError)
    })

    it('includes actionable resolution message', async () => {
      const {StageInputResolutionError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new StageInputResolutionError(
        'Cannot resolve inputs',
        'STAGE_INPUT_MISSING',
        'Missing upstream',
        'Ensure pipeline runs stages in order',
        'orchestrator/input-resolver',
        'permanent',
      )
      expect(error.resolution).toBe('Ensure pipeline runs stages in order')
      expect(error.severity).toBe('permanent')
      expect(error.name).toBe('StageInputResolutionError')
    })
  })
})
