import {MATError} from '../utils/errors.js'
import type {ErrorSeverity} from '../utils/errors.js'

// ============================================================
// Stage Execution Errors (Story 2.2)
// ============================================================
export class StageExecutionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

/**
 * Some agents in a stage failed but the stage produced partial output.
 * This is the "degraded mode" case (FR3, NFR14).
 * The pipeline continues with available outputs; downstream agents
 * receive null for missing upstream agent outputs.
 */
export class StagePartialFailureError extends MATError {
  public readonly failedAgents: string[]
  public readonly succeededAgents: string[]

  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
    failedAgents: string[],
    succeededAgents: string[],
  ) {
    super(message, code, reason, resolution, source, severity)
    this.failedAgents = failedAgents
    this.succeededAgents = succeededAgents
  }
}

/**
 * Upstream stage outputs could not be resolved into inputs for the target stage.
 * This typically means a required upstream stage has not run or produced no output.
 */
export class StageInputResolutionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

// ============================================================
// Pipeline State Machine Errors (Story 2.4)
// ============================================================

export const PIPELINE_STATE_INVALID = 'PIPELINE_STATE_INVALID'
export const PIPELINE_TRANSITION_INVALID = 'PIPELINE_TRANSITION_INVALID'
export const PIPELINE_NOT_FOUND = 'PIPELINE_NOT_FOUND'
export const PIPELINE_CORRUPTED = 'PIPELINE_CORRUPTED'
export const PIPELINE_SERIALIZE_FAILED = 'PIPELINE_SERIALIZE_FAILED'

export class PipelineStateError extends MATError {
  constructor(runId: string, detail: string) {
    super(
      `Invalid pipeline state for run "${runId}"`,
      PIPELINE_STATE_INVALID,
      detail,
      'Check the pipeline run status with `mat status` and take the appropriate action (resume, retry, or start a new run).',
      'orchestrator/pipeline-state',
      'permanent',
    )
  }
}

export class PipelineTransitionError extends MATError {
  constructor(
    runId: string,
    stage: string,
    fromStatus: string,
    toStatus: string,
    detail: string,
  ) {
    super(
      `Invalid stage transition in run "${runId}": "${stage}" cannot go from '${fromStatus}' to '${toStatus}'`,
      PIPELINE_TRANSITION_INVALID,
      detail,
      'This is a programming error in the orchestrator. Please file a bug report.',
      'orchestrator/pipeline-state',
      'permanent',
    )
  }
}

export class PipelineNotFoundError extends MATError {
  constructor(runId: string) {
    super(
      `Pipeline run not found: "${runId}"`,
      PIPELINE_NOT_FOUND,
      `No pipeline run with ID "${runId}" exists in .mat/state/pipeline-runs/.`,
      'Run `mat status` to see available pipeline runs, or start a new run with `mat run`.',
      'orchestrator/state-serializer',
      'permanent',
    )
  }
}

export class PipelineCorruptedError extends MATError {
  constructor(runId: string, detail: string) {
    super(
      `Pipeline run state is corrupted: "${runId}"`,
      PIPELINE_CORRUPTED,
      `The state file for run "${runId}" could not be read: ${detail}`,
      'Delete the corrupted state file at .mat/state/pipeline-runs/<run-id>.json and start a new run.',
      'orchestrator/state-serializer',
      'permanent',
    )
  }
}

export class PipelineSerializeError extends MATError {
  constructor(runId: string, detail: string) {
    super(
      `Failed to save pipeline run state: "${runId}"`,
      PIPELINE_SERIALIZE_FAILED,
      `Could not write state file for run "${runId}": ${detail}`,
      'Check that the .mat/state/pipeline-runs/ directory is writable and disk has available space.',
      'orchestrator/state-serializer',
      'transient',
    )
  }
}

// ============================================================
// Orchestrator Errors (Story 2.5)
// ============================================================

export class PipelineExecutionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class AllAgentsFailedError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}