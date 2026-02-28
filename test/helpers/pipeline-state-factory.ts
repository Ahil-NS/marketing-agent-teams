import type {PipelineRun, PipelineStage, StageResult} from '../../src/lib/orchestrator/types.js'
import {PIPELINE_STAGES} from '../../src/lib/orchestrator/types.js'

/**
 * Creates a test PipelineRun state object with sensible defaults.
 * Shared across orchestrator test files to avoid duplication.
 */
export function createTestPipelineRun(overrides?: Partial<PipelineRun>): PipelineRun {
  const stages = {} as Record<PipelineStage, StageResult>
  for (const stage of PIPELINE_STAGES) {
    stages[stage] = {status: 'pending', agentResults: {}}
  }

  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'running',
    currentStage: 'research',
    stages,
    budget: {spent: 0, limit: 10, currency: 'USD'},
    config: {platforms: ['reddit'], dryRun: false},
    errors: [],
    startedAt: '2026-02-28T10:00:00.000Z',
    updatedAt: '2026-02-28T10:00:00.000Z',
    ...overrides,
  }
}
