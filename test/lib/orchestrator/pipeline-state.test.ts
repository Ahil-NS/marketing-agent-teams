import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {mkdtemp, rm} from 'node:fs/promises'

import {PipelineStateError, PipelineTransitionError} from '../../../src/lib/orchestrator/errors.js'
import {PipelineStateMachine} from '../../../src/lib/orchestrator/pipeline-state.js'
import {loadPipelineRun, savePipelineRun} from '../../../src/lib/orchestrator/state-serializer.js'
import {PIPELINE_STAGES} from '../../../src/lib/orchestrator/types.js'
import {createTestPipelineRun} from '../../helpers/pipeline-state-factory.js'

describe('PipelineStateMachine', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  describe('create()', () => {
    it('creates a new pipeline run with all stages pending', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit', 'tiktok'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      const state = machine.getState()
      expect(state.status).toBe('running')
      expect(state.currentStage).toBe('research')
      expect(state.budget.limit).toBe(10)
      expect(state.budget.spent).toBe(0)
      expect(state.budget.currency).toBe('USD')
      expect(state.config.platforms).toEqual(['reddit', 'tiktok'])
      expect(state.errors).toHaveLength(0)

      // All 7 stages should be pending
      for (const stage of PIPELINE_STAGES) {
        expect(state.stages[stage].status).toBe('pending')
      }
    })

    it('generates a valid UUID as run ID', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      const uuidRegex = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/
      expect(machine.getRunId()).toMatch(uuidRegex)
    })

    it('serializes initial state to disk', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      const loaded = await loadPipelineRun(machine.getRunId(), tmpDir)
      expect(loaded.id).toBe(machine.getRunId())
      expect(loaded.status).toBe('running')
    })
  })

  describe('resume()', () => {
    it('loads a paused pipeline run from disk', async () => {
      const state = createTestPipelineRun({
        status: 'paused',
        currentStage: 'review',
      })
      state.stages.review.status = 'paused'
      await savePipelineRun(state, tmpDir)

      const machine = await PipelineStateMachine.resume(state.id, tmpDir)
      expect(machine.getRunId()).toBe(state.id)
      expect(machine.getCurrentStage()).toBe('review')
      expect(machine.getState().status).toBe('paused')
    })

    it('loads a failed pipeline run from disk', async () => {
      const state = createTestPipelineRun({status: 'failed'})
      state.stages.research.status = 'failed'
      await savePipelineRun(state, tmpDir)

      const machine = await PipelineStateMachine.resume(state.id, tmpDir)
      expect(machine.getState().status).toBe('failed')
    })

    it('throws PipelineStateError when resuming a completed pipeline', async () => {
      const state = createTestPipelineRun({status: 'completed'})
      await savePipelineRun(state, tmpDir)

      await expect(
        PipelineStateMachine.resume(state.id, tmpDir),
      ).rejects.toThrow(PipelineStateError)
    })

    it('throws PipelineStateError when resuming a cancelled pipeline', async () => {
      const state = createTestPipelineRun({status: 'cancelled'})
      await savePipelineRun(state, tmpDir)

      await expect(
        PipelineStateMachine.resume(state.id, tmpDir),
      ).rejects.toThrow(PipelineStateError)
    })
  })

  describe('startStage()', () => {
    it('marks the current stage as running', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()

      const state = machine.getState()
      expect(state.stages.research.status).toBe('running')
      expect(state.stages.research.startedAt).toBeTruthy()
    })

    it('throws PipelineTransitionError when stage is not pending', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()

      // Second startStage should fail — stage is already 'running'
      await expect(machine.startStage()).rejects.toThrow(PipelineTransitionError)
    })

    it('throws PipelineStateError when pipeline is not running', async () => {
      const state = createTestPipelineRun({status: 'paused'})
      state.stages.research.status = 'paused'
      await savePipelineRun(state, tmpDir)

      const machine = await PipelineStateMachine.resume(state.id, tmpDir)
      await expect(machine.startStage()).rejects.toThrow(PipelineStateError)
    })

    it('serializes state after starting stage', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()

      const loaded = await loadPipelineRun(machine.getRunId(), tmpDir)
      expect(loaded.stages.research.status).toBe('running')
    })
  })

  describe('transition()', () => {
    it('completes current stage and advances to next', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      const transition = await machine.transition({trends: ['ai']})

      expect(transition.from).toBe('research')
      expect(transition.to).toBe('strategy')
      expect(transition.fromStatus).toBe('running')
      expect(transition.toStatus).toBe('pending')

      const state = machine.getState()
      expect(state.stages.research.status).toBe('completed')
      expect(state.stages.research.completedAt).toBeTruthy()
      expect(state.stages.research.agentResults).toEqual({trends: ['ai']})
      expect(state.currentStage).toBe('strategy')
    })

    it('throws PipelineTransitionError when stage is not running', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      // Try to transition without calling startStage first
      await expect(machine.transition()).rejects.toThrow(PipelineTransitionError)
    })

    it('throws PipelineStateError when pipeline is not running', async () => {
      const state = createTestPipelineRun({status: 'paused'})
      state.stages.research.status = 'paused'
      await savePipelineRun(state, tmpDir)

      const machine = await PipelineStateMachine.resume(state.id, tmpDir)
      await expect(machine.transition()).rejects.toThrow(PipelineStateError)
    })

    it('serializes state after every transition', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.transition()

      const loaded = await loadPipelineRun(machine.getRunId(), tmpDir)
      expect(loaded.stages.research.status).toBe('completed')
      expect(loaded.currentStage).toBe('strategy')
    })
  })

  describe('auto-pause at review stage', () => {
    it('automatically pauses when advancing to review stage', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      // Advance through research -> strategy -> creation -> optimization -> quality -> review
      const stagesBeforeReview = ['research', 'strategy', 'creation', 'optimization', 'quality'] as const
      for (const _stage of stagesBeforeReview) {
        await machine.startStage()
        await machine.transition()
      }

      // Now currentStage should be 'review' and pipeline should be paused
      const state = machine.getState()
      expect(state.currentStage).toBe('review')
      expect(state.status).toBe('paused')
      expect(state.stages.review.status).toBe('paused')
    })

    it('returns transition with paused toStatus when entering review', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      // Fast-forward to quality stage
      const stagesBeforeQuality = ['research', 'strategy', 'creation', 'optimization'] as const
      for (const _stage of stagesBeforeQuality) {
        await machine.startStage()
        await machine.transition()
      }

      // Transition from quality -> review
      await machine.startStage()
      const transition = await machine.transition()

      expect(transition.from).toBe('quality')
      expect(transition.to).toBe('review')
      expect(transition.toStatus).toBe('paused')
    })
  })

  describe('full pipeline success path', () => {
    it('completes all stages from research to distribution', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      // research -> strategy -> creation -> optimization -> quality
      for (let i = 0; i < 5; i++) {
        await machine.startStage()
        await machine.transition()
      }

      // review is auto-paused
      expect(machine.getState().status).toBe('paused')
      expect(machine.getCurrentStage()).toBe('review')

      // Resume from review
      await machine.unpause()
      await machine.startStage()
      await machine.transition()

      // distribution
      expect(machine.getCurrentStage()).toBe('distribution')
      await machine.startStage()
      const lastTransition = await machine.transition()

      expect(lastTransition.from).toBe('distribution')
      expect(lastTransition.to).toBe('distribution') // No next stage
      expect(lastTransition.toStatus).toBe('completed')

      const finalState = machine.getState()
      expect(finalState.status).toBe('completed')
      expect(finalState.completedAt).toBeTruthy()

      // All stages completed
      for (const stage of PIPELINE_STAGES) {
        expect(finalState.stages[stage].status).toBe('completed')
      }
    })
  })

  describe('fail()', () => {
    it('marks the current stage as failed and records error', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.fail({
        code: 'AGENT_FAILED',
        message: 'Agent crashed',
        reason: 'API timeout',
        resolution: 'Retry',
        severity: 'transient',
      })

      const state = machine.getState()
      expect(state.status).toBe('failed')
      expect(state.stages.research.status).toBe('failed')
      expect(state.stages.research.error).toBeDefined()
      expect(state.stages.research.error?.code).toBe('AGENT_FAILED')
      expect(state.errors).toHaveLength(1)
      expect(state.errors[0].stage).toBe('research')
      expect(state.errors[0].timestamp).toBeTruthy()
    })

    it('throws PipelineStateError when pipeline is in terminal state', async () => {
      const state = createTestPipelineRun({status: 'completed'})
      await savePipelineRun(state, tmpDir)

      // Cannot fail a completed pipeline
      await expect(async () => {
        const machine = await PipelineStateMachine.resume(state.id, tmpDir)
        await machine.fail({
          code: 'TEST',
          message: 'test',
          reason: 'test',
          resolution: 'test',
          severity: 'transient',
        })
      }).rejects.toThrow(PipelineStateError)
    })

    it('serializes state after failure', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.fail({
        code: 'FAIL',
        message: 'Failed',
        reason: 'Error',
        resolution: 'Fix it',
        severity: 'permanent',
      })

      const loaded = await loadPipelineRun(machine.getRunId(), tmpDir)
      expect(loaded.status).toBe('failed')
      expect(loaded.errors).toHaveLength(1)
    })
  })

  describe('pause()', () => {
    it('pauses a running pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.pause()

      const state = machine.getState()
      expect(state.status).toBe('paused')
      expect(state.stages.research.status).toBe('paused')
    })

    it('throws PipelineStateError when pipeline is not running', async () => {
      const state = createTestPipelineRun({status: 'failed'})
      state.stages.research.status = 'failed'
      await savePipelineRun(state, tmpDir)

      const machine = await PipelineStateMachine.resume(state.id, tmpDir)
      await expect(machine.pause()).rejects.toThrow(PipelineStateError)
    })
  })

  describe('unpause()', () => {
    it('resumes a paused pipeline, resetting current stage to pending', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.pause()
      await machine.unpause()

      const state = machine.getState()
      expect(state.status).toBe('running')
      expect(state.stages.research.status).toBe('pending')
    })

    it('throws PipelineStateError when pipeline is not paused', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await expect(machine.unpause()).rejects.toThrow(PipelineStateError)
    })
  })

  describe('retry()', () => {
    it('resets a failed stage to pending and pipeline to running', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.fail({
        code: 'FAIL',
        message: 'Failed',
        reason: 'Error',
        resolution: 'Retry',
        severity: 'transient',
      })

      await machine.retry()

      const state = machine.getState()
      expect(state.status).toBe('running')
      expect(state.stages.research.status).toBe('pending')
      expect(state.stages.research.error).toBeUndefined()
      expect(state.stages.research.startedAt).toBeUndefined()
      expect(state.stages.research.completedAt).toBeUndefined()
      expect(state.stages.research.agentResults).toEqual({})
    })

    it('allows re-execution after retry', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.fail({
        code: 'FAIL',
        message: 'Failed',
        reason: 'Error',
        resolution: 'Retry',
        severity: 'transient',
      })

      await machine.retry()
      await machine.startStage()
      await machine.transition({retried: true})

      const state = machine.getState()
      expect(state.stages.research.status).toBe('completed')
      expect(state.currentStage).toBe('strategy')
    })

    it('throws PipelineStateError when pipeline is not failed', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await expect(machine.retry()).rejects.toThrow(PipelineStateError)
    })
  })

  describe('cancel()', () => {
    it('cancels a running pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.cancel()

      const state = machine.getState()
      expect(state.status).toBe('cancelled')
    })

    it('cancels a paused pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.pause()
      await machine.cancel()

      expect(machine.getState().status).toBe('cancelled')
    })

    it('cancels a failed pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.fail({
        code: 'FAIL',
        message: 'Failed',
        reason: 'Error',
        resolution: 'Retry',
        severity: 'transient',
      })
      await machine.cancel()

      expect(machine.getState().status).toBe('cancelled')
    })

    it('throws PipelineStateError when pipeline is already completed', async () => {
      const state = createTestPipelineRun({status: 'completed'})
      await savePipelineRun(state, tmpDir)

      await expect(async () => {
        const machine = await PipelineStateMachine.resume(state.id, tmpDir)
        await machine.cancel()
      }).rejects.toThrow(PipelineStateError)
    })

    it('throws PipelineStateError when pipeline is already cancelled', async () => {
      const state = createTestPipelineRun({status: 'cancelled'})
      await savePipelineRun(state, tmpDir)

      await expect(
        PipelineStateMachine.resume(state.id, tmpDir),
      ).rejects.toThrow(PipelineStateError)
    })

    it('serializes cancelled state to disk', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.cancel()

      const loaded = await loadPipelineRun(machine.getRunId(), tmpDir)
      expect(loaded.status).toBe('cancelled')
    })
  })

  describe('updateBudget()', () => {
    it('updates the budget spent amount', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      await machine.updateBudget(2.50)

      expect(machine.getState().budget.spent).toBe(2.50)
    })

    it('serializes budget update to disk', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      await machine.updateBudget(3.75)

      const loaded = await loadPipelineRun(machine.getRunId(), tmpDir)
      expect(loaded.budget.spent).toBe(3.75)
    })

    it('throws PipelineStateError when pipeline is not running', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      await machine.pause()
      await expect(machine.updateBudget(1.0)).rejects.toThrow(PipelineStateError)
    })

    it('throws PipelineStateError for negative budget', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      await expect(machine.updateBudget(-5)).rejects.toThrow(PipelineStateError)
    })
  })

  describe('invalid state transitions', () => {
    it('cannot transition from pending stage (must start first)', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await expect(machine.transition()).rejects.toThrow(PipelineTransitionError)
    })

    it('cannot start a stage that is already running', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await expect(machine.startStage()).rejects.toThrow(PipelineTransitionError)
    })

    it('cannot resume a completed pipeline', async () => {
      const state = createTestPipelineRun({status: 'completed'})
      await savePipelineRun(state, tmpDir)

      await expect(
        PipelineStateMachine.resume(state.id, tmpDir),
      ).rejects.toThrow(PipelineStateError)
    })

    it('cannot unpause a running pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await expect(machine.unpause()).rejects.toThrow(PipelineStateError)
    })

    it('cannot retry a running pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await expect(machine.retry()).rejects.toThrow(PipelineStateError)
    })

    it('cannot pause a failed pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.startStage()
      await machine.fail({
        code: 'FAIL',
        message: 'Failed',
        reason: 'Test',
        resolution: 'Test',
        severity: 'transient',
      })

      await expect(machine.pause()).rejects.toThrow(PipelineStateError)
    })

    it('cannot fail a paused pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      await machine.pause()
      await expect(machine.fail({
        code: 'FAIL',
        message: 'Failed',
        reason: 'Test',
        resolution: 'Test',
        severity: 'transient',
      })).rejects.toThrow(PipelineStateError)
    })

    it('cannot update budget on a paused pipeline', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 10},
        tmpDir,
      )

      await machine.pause()
      await expect(machine.updateBudget(1.5)).rejects.toThrow(PipelineStateError)
    })
  })

  describe('getState() deep copy', () => {
    it('returns a deep copy that cannot mutate internal state', async () => {
      const machine = await PipelineStateMachine.create(
        {platforms: ['reddit'], dryRun: false},
        {limit: 5},
        tmpDir,
      )

      const snapshot = machine.getState()
      // Attempt to mutate the returned snapshot
      ;(snapshot.stages.research as { status: string }).status = 'completed'
      ;(snapshot.budget as { spent: number }).spent = 999

      // Internal state should be unaffected
      const fresh = machine.getState()
      expect(fresh.stages.research.status).toBe('pending')
      expect(fresh.budget.spent).toBe(0)
    })
  })
})
