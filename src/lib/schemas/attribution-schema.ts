import {z} from 'zod'

import {pipelineStageSchema} from './pipeline-run-schema.js'

/**
 * Tracks the AI model that generated or processed a piece of content.
 * Captured from every Agent SDK query() call for transparency (FR28).
 */
export const modelAttributionSchema = z.object({
  /** Full model identifier (e.g., 'claude-haiku-4-2025-04-14') */
  modelName: z.string().min(1),
  /** AI provider name (e.g., 'anthropic') */
  provider: z.string().min(1),
  /** ISO 8601 timestamp of when the generation occurred */
  timestamp: z.string().datetime(),
  /** Number of input tokens consumed */
  inputTokens: z.number().int().min(0),
  /** Number of output tokens produced */
  outputTokens: z.number().int().min(0),
  /** Cost in USD for this generation call */
  cost: z.number().min(0),
})

export type ModelAttribution = z.infer<typeof modelAttributionSchema>

/**
 * A single entry in a content item's attribution chain.
 * Extends ModelAttribution with pipeline context (which agent, stage, run).
 */
export const attributionEntrySchema = modelAttributionSchema.extend({
  /** Agent that made this AI call */
  agentName: z.string().min(1),
  /** Pipeline stage during which this call was made */
  stage: pipelineStageSchema,
  /** Pipeline run ID */
  runId: z.string().min(1),
})

export type AttributionEntry = z.infer<typeof attributionEntrySchema>

/**
 * Ordered list of all AI model calls that contributed to a content item.
 * Entries are appended chronologically as content flows through pipeline stages.
 */
export const attributionChainSchema = z.array(attributionEntrySchema)

export type AttributionChain = z.infer<typeof attributionChainSchema>
