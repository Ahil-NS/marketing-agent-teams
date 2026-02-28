import {MATError} from '../utils/errors.js'
import type {ErrorSeverity} from '../utils/errors.js'

/**
 * All agents in a stage failed — stage cannot produce any output.
 * Pipeline may continue if downstream stages can tolerate missing input.
 */
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
