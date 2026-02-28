import {describe, expect, it} from 'vitest'

import {
  pipelineErrorSchema,
  pipelineRunSchema,
  pipelineRunStatusSchema,
  pipelineStageSchema,
  stageResultSchema,
  stageStatusSchema,
} from '../../../src/lib/schemas/pipeline-run-schema.js'

import runningFixture from '../../fixtures/state/running-pipeline.json'
import pausedFixture from '../../fixtures/state/paused-at-review.json'
import failedFixture from '../../fixtures/state/failed-pipeline.json'

describe('pipeline-run-schema', () => {
  describe('pipelineStageSchema', () => {
    it('accepts valid pipeline stages', () => {
      const stages = ['research', 'strategy', 'creation', 'optimization', 'quality', 'review', 'distribution']
      for (const stage of stages) {
        expect(pipelineStageSchema.safeParse(stage).success).toBe(true)
      }
    })

    it('rejects invalid stage values', () => {
      expect(pipelineStageSchema.safeParse('unknown').success).toBe(false)
      expect(pipelineStageSchema.safeParse('planning').success).toBe(false)
      expect(pipelineStageSchema.safeParse('').success).toBe(false)
      expect(pipelineStageSchema.safeParse(123).success).toBe(false)
    })
  })

  describe('stageStatusSchema', () => {
    it('accepts valid stage statuses', () => {
      const statuses = ['pending', 'running', 'completed', 'failed', 'paused']
      for (const status of statuses) {
        expect(stageStatusSchema.safeParse(status).success).toBe(true)
      }
    })

    it('rejects invalid status values', () => {
      expect(stageStatusSchema.safeParse('partial').success).toBe(false)
      expect(stageStatusSchema.safeParse('skipped').success).toBe(false)
      expect(stageStatusSchema.safeParse('').success).toBe(false)
    })
  })

  describe('pipelineRunStatusSchema', () => {
    it('accepts valid pipeline run statuses', () => {
      const statuses = ['running', 'paused', 'completed', 'failed', 'cancelled']
      for (const status of statuses) {
        expect(pipelineRunStatusSchema.safeParse(status).success).toBe(true)
      }
    })

    it('rejects invalid status values', () => {
      expect(pipelineRunStatusSchema.safeParse('pending').success).toBe(false)
      expect(pipelineRunStatusSchema.safeParse('unknown').success).toBe(false)
    })
  })

  describe('pipelineErrorSchema', () => {
    const validError = {
      stage: 'creation',
      code: 'AGENT_FAILED',
      message: 'Agent failed',
      reason: 'Rate limit',
      resolution: 'Retry later',
      severity: 'transient',
      timestamp: '2026-02-28T10:00:00.000Z',
    }

    it('accepts a valid pipeline error', () => {
      expect(pipelineErrorSchema.safeParse(validError).success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const {stage: _, ...noStage} = validError
      expect(pipelineErrorSchema.safeParse(noStage).success).toBe(false)

      const {code: __, ...noCode} = validError
      expect(pipelineErrorSchema.safeParse(noCode).success).toBe(false)
    })

    it('rejects empty string fields', () => {
      expect(pipelineErrorSchema.safeParse({...validError, code: ''}).success).toBe(false)
      expect(pipelineErrorSchema.safeParse({...validError, message: ''}).success).toBe(false)
    })

    it('rejects invalid severity', () => {
      expect(pipelineErrorSchema.safeParse({...validError, severity: 'warning'}).success).toBe(false)
    })

    it('rejects invalid timestamp format', () => {
      expect(pipelineErrorSchema.safeParse({...validError, timestamp: 'not-a-date'}).success).toBe(false)
    })
  })

  describe('stageResultSchema', () => {
    it('accepts a valid stage result with minimal fields', () => {
      const result = {status: 'pending', agentResults: {}}
      expect(stageResultSchema.safeParse(result).success).toBe(true)
    })

    it('accepts a valid stage result with all fields', () => {
      const result = {
        status: 'completed',
        agentResults: {'trend-scout': {trends: ['ai']}},
        startedAt: '2026-02-28T10:00:00.000Z',
        completedAt: '2026-02-28T10:05:00.000Z',
      }

      expect(stageResultSchema.safeParse(result).success).toBe(true)
    })

    it('accepts a stage result with an error', () => {
      const result = {
        status: 'failed',
        agentResults: {},
        startedAt: '2026-02-28T10:00:00.000Z',
        error: {
          stage: 'creation',
          code: 'FAIL',
          message: 'Failed',
          reason: 'Error',
          resolution: 'Retry',
          severity: 'transient',
          timestamp: '2026-02-28T10:05:00.000Z',
        },
      }

      expect(stageResultSchema.safeParse(result).success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = {status: 'unknown', agentResults: {}}
      expect(stageResultSchema.safeParse(result).success).toBe(false)
    })

    it('rejects missing agentResults', () => {
      const result = {status: 'pending'}
      expect(stageResultSchema.safeParse(result).success).toBe(false)
    })
  })

  describe('pipelineRunSchema', () => {
    it('validates the running pipeline fixture', () => {
      const result = pipelineRunSchema.safeParse(runningFixture)
      expect(result.success).toBe(true)
    })

    it('validates the paused-at-review fixture', () => {
      const result = pipelineRunSchema.safeParse(pausedFixture)
      expect(result.success).toBe(true)
    })

    it('validates the failed pipeline fixture', () => {
      const result = pipelineRunSchema.safeParse(failedFixture)
      expect(result.success).toBe(true)
    })

    it('rejects invalid UUID format', () => {
      const invalid = {...runningFixture, id: 'not-a-uuid'}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects invalid pipeline status', () => {
      const invalid = {...runningFixture, status: 'unknown'}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects invalid currentStage', () => {
      const invalid = {...runningFixture, currentStage: 'planning'}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects negative budget values', () => {
      const invalid = {...runningFixture, budget: {spent: -1, limit: 10, currency: 'USD', dailySpent: 0, dailyLimit: 10}}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects invalid currency', () => {
      const invalid = {...runningFixture, budget: {spent: 0, limit: 10, currency: 'EUR', dailySpent: 0, dailyLimit: 10}}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects missing required fields', () => {
      const {id: _, ...noId} = runningFixture
      expect(pipelineRunSchema.safeParse(noId).success).toBe(false)

      const {status: __, ...noStatus} = runningFixture
      expect(pipelineRunSchema.safeParse(noStatus).success).toBe(false)

      const {stages: ___, ...noStages} = runningFixture
      expect(pipelineRunSchema.safeParse(noStages).success).toBe(false)
    })

    it('rejects invalid datetime format for startedAt', () => {
      const invalid = {...runningFixture, startedAt: 'not-a-date'}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects empty platforms array with empty string', () => {
      const invalid = {...runningFixture, config: {platforms: [''], dryRun: false}}
      expect(pipelineRunSchema.safeParse(invalid).success).toBe(false)
    })
  })
})
