import type {PipelineStage} from './types.js'
import {PIPELINE_STAGES, STAGE_AGENT_MAP} from './types.js'

/**
 * Returns the list of agent names assigned to a given pipeline stage.
 * Delegates to STAGE_AGENT_MAP — the single source of truth.
 */
export function getStageAgents(stage: PipelineStage): readonly string[] {
  return STAGE_AGENT_MAP[stage]
}

/**
 * Returns the StageDefinition-like info for a pipeline stage.
 * Combines stage name, agents, and whether agents run in parallel.
 *
 * Parallel stages (creation, distribution): agents are independent
 * and run via Promise.allSettled(). All other stages run agents
 * sequentially within the stage (though StageRunner currently runs
 * all agents in parallel; the Orchestrator respects this flag).
 */
export function getStageDefinition(stage: PipelineStage): {
  name: PipelineStage
  agents: readonly string[]
  parallel: boolean
} {
  const idx = PIPELINE_STAGES.indexOf(stage)
  if (idx === -1) {
    throw new Error(`Unknown pipeline stage: ${stage}`)
  }

  return {
    name: stage,
    agents: STAGE_AGENT_MAP[stage],
    parallel: stage === 'creation' || stage === 'distribution',
  }
}

/**
 * Returns all pipeline stages that come after the given stage.
 * Used for resume support — determines which stages still need execution.
 */
export function getStagesAfter(stage: PipelineStage): PipelineStage[] {
  const index = PIPELINE_STAGES.indexOf(stage)
  if (index === -1) {
    return []
  }

  return [...PIPELINE_STAGES.slice(index + 1)]
}

/**
 * Returns all pipeline stages from the given stage onward (inclusive).
 */
export function getStagesFrom(stage: PipelineStage): PipelineStage[] {
  const index = PIPELINE_STAGES.indexOf(stage)
  if (index === -1) {
    return []
  }

  return [...PIPELINE_STAGES.slice(index)]
}
