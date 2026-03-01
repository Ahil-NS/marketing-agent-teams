import {z} from 'zod'

/**
 * Schema for a single rejection pattern — captures a rejected content angle
 * with keywords for similarity-based deprioritization.
 *
 * Stored as JSON inside a MemoryEntry.content field with type: 'rejection'.
 */
export const rejectionPatternSchema = z.object({
  /** Unique rejection ID (UUID) */
  id: z.string().uuid(),
  /** ID of the rejected content item */
  contentItemId: z.string().min(1),
  /** Extracted topic/angle that was rejected */
  rejectedAngle: z.string().min(1),
  /** User-provided reason for rejection */
  rejectionReason: z.string().min(1),
  /** Which agent produced the rejected content */
  agentName: z.string().min(1),
  /** ISO 8601 timestamp of when the rejection occurred */
  timestamp: z.string().datetime(),
  /** Extracted keywords for pattern matching (Jaccard similarity) */
  keywords: z.array(z.string()),
  /** How strongly to deprioritize this angle (0 = ignore, 1 = full deprioritization) */
  confidence: z.number().min(0).max(1).default(1.0),
})

export type RejectionPattern = z.infer<typeof rejectionPatternSchema>

/**
 * Aggregated rejection memory — a collection of rejection patterns
 * with a last-updated timestamp.
 */
export const rejectionMemorySchema = z.object({
  /** All recorded rejection patterns */
  patterns: z.array(rejectionPatternSchema),
  /** ISO 8601 timestamp of the last update to this memory */
  lastUpdated: z.string().datetime(),
})

export type RejectionMemory = z.infer<typeof rejectionMemorySchema>
