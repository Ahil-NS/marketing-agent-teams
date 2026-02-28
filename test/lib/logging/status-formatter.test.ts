import {describe, expect, it} from 'vitest'

import {formatRunErrors, formatRunStatus, formatRunSummary} from '../../../src/lib/logging/status-formatter.js'
import {createTestPipelineRun} from '../../helpers/pipeline-state-factory.js'
import type {PipelineRun} from '../../../src/lib/orchestrator/types.js'

describe('Status Formatter', () => {
  describe('formatRunStatus', () => {
    it('formats an active run with current stage indicator', () => {
      const run = createTestPipelineRun({
        status: 'running',
        currentStage: 'strategy',
        stages: {
          ...createTestPipelineRun().stages,
          research: {status: 'completed', agentResults: {'trend-scout': {}, 'audience-researcher': {}}},
          strategy: {status: 'running', agentResults: {'content-strategist': {}}},
        },
      })

      const output = formatRunStatus(run)

      expect(output).toContain('Pipeline Run:')
      expect(output).toContain('Status: running')
      expect(output).toContain('[OK] research')
      expect(output).toContain('[>>] strategy')
      expect(output).toContain('(2 agents)')
      expect(output).toContain('(1 agents)')
    })

    it('formats a completed run with all stages OK', () => {
      const completedStages = {} as Record<string, {status: string; agentResults: Record<string, unknown>}>
      for (const stage of ['research', 'strategy', 'creation', 'optimization', 'quality', 'review', 'distribution']) {
        completedStages[stage] = {status: 'completed', agentResults: {}}
      }

      const run = createTestPipelineRun({
        status: 'completed',
        stages: completedStages as PipelineRun['stages'],
      })

      const output = formatRunStatus(run)
      expect(output).toContain('Status: completed')
      // All stages should show OK
      const okCount = (output.match(/\[OK\]/g) || []).length
      expect(okCount).toBe(7)
    })

    it('formats a failed run with error details', () => {
      const run = createTestPipelineRun({
        status: 'failed',
        stages: {
          ...createTestPipelineRun().stages,
          research: {status: 'completed', agentResults: {}},
          strategy: {status: 'failed', agentResults: {}, error: {
            stage: 'strategy',
            code: 'AGENT_TIMEOUT',
            message: 'Agent timed out',
            reason: 'LLM response exceeded 5 minute limit',
            resolution: 'Retry or increase timeout',
            severity: 'transient',
            timestamp: '2026-02-28T10:05:00.000Z',
          }},
        },
        errors: [{
          stage: 'strategy',
          code: 'AGENT_TIMEOUT',
          message: 'Agent timed out',
          reason: 'LLM response exceeded 5 minute limit',
          resolution: 'Retry or increase timeout',
          severity: 'transient',
          timestamp: '2026-02-28T10:05:00.000Z',
        }],
      })

      const output = formatRunStatus(run)
      expect(output).toContain('Status: failed')
      expect(output).toContain('[!!] strategy')
      expect(output).toContain('Errors:')
      expect(output).toContain('[AGENT_TIMEOUT]')
      expect(output).toContain('Fix: Retry or increase timeout')
    })

    it('shows dry-run mode indicator', () => {
      const run = createTestPipelineRun({
        config: {platforms: ['reddit'], dryRun: true},
      })

      const output = formatRunStatus(run)
      expect(output).toContain('Mode: dry-run')
    })

    it('does not show Mode line when not dry-run', () => {
      const run = createTestPipelineRun({
        config: {platforms: ['reddit'], dryRun: false},
      })

      const output = formatRunStatus(run)
      expect(output).not.toContain('Mode:')
    })

    it('formats budget information', () => {
      const run = createTestPipelineRun({
        budget: {spent: 1.2345, limit: 10, currency: 'USD', dailySpent: 1.2345, dailyLimit: 10},
      })

      const output = formatRunStatus(run)
      expect(output).toContain('Budget: $1.2345 / $10.00')
    })

    it('shows unlimited when budget limit is 0', () => {
      const run = createTestPipelineRun({
        budget: {spent: 0, limit: 0, currency: 'USD', dailySpent: 0, dailyLimit: 0},
      })

      const output = formatRunStatus(run)
      expect(output).toContain('Budget: $0.0000 / $unlimited')
    })

    it('shows paused indicator for paused stage', () => {
      const run = createTestPipelineRun({
        status: 'paused',
        currentStage: 'review',
        stages: {
          ...createTestPipelineRun().stages,
          research: {status: 'completed', agentResults: {}},
          strategy: {status: 'completed', agentResults: {}},
          creation: {status: 'completed', agentResults: {}},
          optimization: {status: 'completed', agentResults: {}},
          quality: {status: 'completed', agentResults: {}},
          review: {status: 'paused', agentResults: {}},
        },
      })

      const output = formatRunStatus(run)
      expect(output).toContain('[||] review')
    })
  })

  describe('formatRunErrors', () => {
    it('formats errors with code, message, reason, and resolution', () => {
      const errors = [{
        stage: 'research' as const,
        code: 'AGENT_TIMEOUT',
        message: 'Agent timed out',
        reason: 'API response too slow',
        resolution: 'Retry the pipeline',
        severity: 'transient' as const,
        timestamp: '2026-02-28T10:00:00.000Z',
      }]

      const output = formatRunErrors(errors)
      expect(output).toContain('Errors:')
      expect(output).toContain('[AGENT_TIMEOUT]')
      expect(output).toContain('Agent timed out')
      expect(output).toContain('Reason: API response too slow')
      expect(output).toContain('Fix: Retry the pipeline')
    })

    it('handles multiple errors', () => {
      const errors = [
        {stage: 'research' as const, code: 'ERR_1', message: 'Error 1', reason: 'Reason 1', resolution: 'Fix 1', severity: 'transient' as const, timestamp: '2026-02-28T10:00:00.000Z'},
        {stage: 'strategy' as const, code: 'ERR_2', message: 'Error 2', reason: 'Reason 2', resolution: 'Fix 2', severity: 'permanent' as const, timestamp: '2026-02-28T10:01:00.000Z'},
      ]

      const output = formatRunErrors(errors)
      expect(output).toContain('[ERR_1]')
      expect(output).toContain('[ERR_2]')
    })
  })

  describe('formatRunSummary', () => {
    it('returns helpful message for empty runs array', () => {
      const output = formatRunSummary([])
      expect(output).toContain('No pipeline runs found')
      expect(output).toContain('mat run')
    })

    it('formats a summary table of runs', () => {
      const runs = [
        createTestPipelineRun({
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          status: 'completed',
          startedAt: '2026-02-28T10:00:00.000Z',
        }),
        createTestPipelineRun({
          id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          status: 'running',
          startedAt: '2026-02-28T11:00:00.000Z',
        }),
      ]

      const output = formatRunSummary(runs)
      expect(output).toContain('Pipeline Run History:')
      expect(output).toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(output).toContain('b2c3d4e5-f6a7-8901-bcde-f12345678901')
      expect(output).toContain('completed')
      expect(output).toContain('running')
    })

    it('shows completed stage count', () => {
      const run = createTestPipelineRun({
        stages: {
          ...createTestPipelineRun().stages,
          research: {status: 'completed', agentResults: {}},
          strategy: {status: 'completed', agentResults: {}},
        },
      })

      const output = formatRunSummary([run])
      expect(output).toContain('2/7')
    })
  })
})
