import type {PipelineStage, WorkflowMode} from './types.js'
import {PIPELINE_STAGES} from './types.js'

/**
 * Stage sequences for each workflow mode.
 */
const WORKFLOW_STAGES: Record<WorkflowMode, readonly PipelineStage[]> = {
  /** Full pipeline: all 7 stages */
  full: PIPELINE_STAGES,

  /** Brief mode: skip research + strategy, start at creation */
  brief: ['creation', 'optimization', 'quality', 'review', 'distribution'],

  /** Idea mode: research then create (skip strategy) */
  idea: ['research', 'creation', 'optimization', 'quality', 'review', 'distribution'],

  /** Single agent mode: just runs the one agent, no pipeline */
  single: [],

  /** Optimize mode: research + optimize existing content, then publish */
  optimize: ['research', 'optimization', 'review', 'distribution'],
}

/**
 * Returns the stage sequence for a given workflow mode.
 */
export function getWorkflowStages(mode: WorkflowMode): readonly PipelineStage[] {
  return WORKFLOW_STAGES[mode] ?? PIPELINE_STAGES
}

/**
 * Checks if a stage is active in the given workflow.
 */
export function isStageActive(stage: PipelineStage, mode: WorkflowMode): boolean {
  return WORKFLOW_STAGES[mode].includes(stage)
}
