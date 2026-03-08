import type {PipelineStage, WorkflowMode, OptimizeInput} from './types.js'
import {getWorkflowStages} from './pipeline-presets.js'

export interface WorkflowInput {
  /** Path to a brief file to use as creation input */
  briefPath?: string
  /** Idea/topic string for targeted research */
  idea?: string
  /** Single agent name to run in isolation */
  agent?: string
  /** Existing content optimization (ECT workflow) */
  optimize?: OptimizeInput
}

export interface ResolvedWorkflow {
  mode: WorkflowMode
  stages: readonly PipelineStage[]
  input: WorkflowInput
}

/**
 * Analyzes input and determines the appropriate workflow mode
 * and active pipeline stages.
 */
export function resolveWorkflow(input: WorkflowInput): ResolvedWorkflow {
  if (input.optimize) {
    return {
      mode: 'optimize',
      stages: getWorkflowStages('optimize'),
      input,
    }
  }

  if (input.agent) {
    return {
      mode: 'single',
      stages: getWorkflowStages('single'),
      input,
    }
  }

  if (input.briefPath) {
    return {
      mode: 'brief',
      stages: getWorkflowStages('brief'),
      input,
    }
  }

  if (input.idea) {
    return {
      mode: 'idea',
      stages: getWorkflowStages('idea'),
      input,
    }
  }

  return {
    mode: 'full',
    stages: getWorkflowStages('full'),
    input,
  }
}
