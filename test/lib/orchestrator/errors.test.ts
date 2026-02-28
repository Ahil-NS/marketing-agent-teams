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

  // ============================================================
  // Pipeline State Machine Errors (Story 2.4)
  // ============================================================

  describe('PipelineStateError', () => {
    it('extends MATError', async () => {
      const {PipelineStateError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineStateError('run-123', 'Pipeline is completed')
      expect(error).toBeInstanceOf(MATError)
      expect(error).toBeInstanceOf(Error)
    })

    it('sets correct code, source, and severity', async () => {
      const {PipelineStateError, PIPELINE_STATE_INVALID} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineStateError('run-123', 'Pipeline is completed — cannot resume')
      expect(error.code).toBe(PIPELINE_STATE_INVALID)
      expect(error.source).toBe('orchestrator/pipeline-state')
      expect(error.severity).toBe('permanent')
      expect(error.name).toBe('PipelineStateError')
      expect(error.message).toContain('run-123')
      expect(error.reason).toBe('Pipeline is completed — cannot resume')
      expect(error.resolution).toContain('mat status')
    })
  })

  describe('PipelineTransitionError', () => {
    it('extends MATError', async () => {
      const {PipelineTransitionError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineTransitionError('run-123', 'research', 'pending', 'completed', 'Must be running first')
      expect(error).toBeInstanceOf(MATError)
    })

    it('sets correct code and includes stage info in message', async () => {
      const {PipelineTransitionError, PIPELINE_TRANSITION_INVALID} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineTransitionError('run-456', 'creation', 'pending', 'completed', 'Stage must be running')
      expect(error.code).toBe(PIPELINE_TRANSITION_INVALID)
      expect(error.message).toContain('run-456')
      expect(error.message).toContain('creation')
      expect(error.message).toContain('pending')
      expect(error.message).toContain('completed')
      expect(error.source).toBe('orchestrator/pipeline-state')
      expect(error.severity).toBe('permanent')
      expect(error.name).toBe('PipelineTransitionError')
    })
  })

  describe('PipelineNotFoundError', () => {
    it('extends MATError', async () => {
      const {PipelineNotFoundError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineNotFoundError('run-999')
      expect(error).toBeInstanceOf(MATError)
    })

    it('sets correct code and actionable resolution', async () => {
      const {PipelineNotFoundError, PIPELINE_NOT_FOUND} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineNotFoundError('run-999')
      expect(error.code).toBe(PIPELINE_NOT_FOUND)
      expect(error.message).toContain('run-999')
      expect(error.reason).toContain('run-999')
      expect(error.resolution).toContain('mat status')
      expect(error.source).toBe('orchestrator/state-serializer')
      expect(error.severity).toBe('permanent')
      expect(error.name).toBe('PipelineNotFoundError')
    })
  })

  describe('PipelineCorruptedError', () => {
    it('extends MATError', async () => {
      const {PipelineCorruptedError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineCorruptedError('run-bad', 'Invalid JSON at position 42')
      expect(error).toBeInstanceOf(MATError)
    })

    it('sets correct code and includes detail in reason', async () => {
      const {PipelineCorruptedError, PIPELINE_CORRUPTED} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineCorruptedError('run-bad', 'Schema validation failed')
      expect(error.code).toBe(PIPELINE_CORRUPTED)
      expect(error.message).toContain('run-bad')
      expect(error.reason).toContain('Schema validation failed')
      expect(error.resolution).toContain('Delete the corrupted state file')
      expect(error.source).toBe('orchestrator/state-serializer')
      expect(error.severity).toBe('permanent')
      expect(error.name).toBe('PipelineCorruptedError')
    })
  })

  describe('PipelineSerializeError', () => {
    it('extends MATError', async () => {
      const {PipelineSerializeError} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineSerializeError('run-123', 'ENOSPC: no space left on device')
      expect(error).toBeInstanceOf(MATError)
    })

    it('sets transient severity (can be retried)', async () => {
      const {PipelineSerializeError, PIPELINE_SERIALIZE_FAILED} = await import('../../../src/lib/orchestrator/errors.js')
      const error = new PipelineSerializeError('run-123', 'EACCES: permission denied')
      expect(error.code).toBe(PIPELINE_SERIALIZE_FAILED)
      expect(error.severity).toBe('transient')
      expect(error.source).toBe('orchestrator/state-serializer')
      expect(error.resolution).toContain('writable')
      expect(error.name).toBe('PipelineSerializeError')
    })
  })
})
