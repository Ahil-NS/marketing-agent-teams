import type {AgentResult} from './types.js'
import type {AttributionChain, AttributionEntry} from '../schemas/attribution-schema.js'
import type {PipelineStage} from '../orchestrator/types.js'

/**
 * Build an attribution entry from an AgentResult's usage data.
 * Called by the stage-runner after each agent completes (FR28).
 */
export function buildAttributionEntry(
  agentResult: AgentResult,
  stage: PipelineStage,
  runId: string,
): AttributionEntry {
  return {
    agentName: agentResult.agentName,
    stage,
    runId,
    modelName: agentResult.usage.modelName,
    provider: agentResult.usage.provider,
    timestamp: agentResult.usage.timestamp,
    inputTokens: agentResult.usage.inputTokens,
    outputTokens: agentResult.usage.outputTokens,
    cost: agentResult.usage.cost,
  }
}

/**
 * Append an attribution entry to an existing chain.
 * Returns a NEW array — does not mutate the input chain (immutable).
 */
export function appendToAttributionChain(
  chain: AttributionChain,
  entry: AttributionEntry,
): AttributionChain {
  return [...chain, entry]
}
