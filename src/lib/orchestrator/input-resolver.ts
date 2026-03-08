import {StageInputResolutionError} from './errors.js'
import type {PipelineStage, StageExecutionResult} from './types.js'
import {PIPELINE_STAGES} from './types.js'

/**
 * Maps each stage to the upstream stages it depends on for input.
 * Research has no upstream (it uses PipelineRun.config as input).
 * Distribution has no upstream dependencies (uses approved items from review queue).
 */
const STAGE_INPUT_DEPENDENCIES: Record<PipelineStage, readonly PipelineStage[]> = {
  research: [],
  strategy: ['research'],
  creation: ['research', 'strategy'],
  optimization: ['creation', 'research'],
  quality: ['creation', 'optimization'],
  review: ['quality'],
  distribution: [],
} as const

/**
 * Resolve inputs for a pipeline stage from upstream stage results.
 *
 * In degraded mode (some upstream agents failed), available outputs are
 * collected and missing data is marked as null. Downstream agents must
 * handle partial context gracefully.
 *
 * @param stage - Target stage to resolve inputs for
 * @param stageResults - Current pipeline run stage results
 * @returns Resolved inputs as a record of upstream agent outputs
 * @throws StageInputResolutionError if required upstream stages have not run
 */
export function resolveInputs(
  stage: PipelineStage,
  stageResults: Partial<Record<PipelineStage, StageExecutionResult>>,
): Record<string, unknown> {
  const dependencies = STAGE_INPUT_DEPENDENCIES[stage]

  if (dependencies.length === 0) {
    return {}
  }

  const resolvedInputs: Record<string, unknown> = {}

  for (const depStage of dependencies) {
    const depResult = stageResults[depStage]

    if (!depResult || depResult.status === 'pending') {
      // In flexible workflows, upstream stages may be skipped.
      // If the stage was marked completed with empty results (skipped),
      // continue without throwing.
      if (depResult?.status === 'skipped' || depResult?.status === 'completed') {
        continue
      }
      // For truly missing stages, throw only if not skipped
      if (!depResult) {
        continue // Gracefully skip missing upstream in flexible workflows
      }
      throw new StageInputResolutionError(
        `Stage "${stage}" depends on stage "${depStage}" which has not executed yet`,
        'STAGE_INPUT_MISSING',
        `Upstream stage "${depStage}" has not been executed. Cannot resolve inputs for stage "${stage}".`,
        `Ensure the pipeline runs stages in order: ${PIPELINE_STAGES.join(' -> ')}. Check if stage "${depStage}" was skipped or is still pending.`,
        'orchestrator/input-resolver',
        'permanent',
      )
    }

    for (const [agentName, agentResult] of Object.entries(depResult.agentResults)) {
      if (agentResult.status === 'success' && agentResult.result) {
        resolvedInputs[agentName] = agentResult.result.outputs
      } else {
        // Degraded mode: mark failed agent output as null (FR3)
        resolvedInputs[agentName] = null
      }
    }
  }

  return resolvedInputs
}
