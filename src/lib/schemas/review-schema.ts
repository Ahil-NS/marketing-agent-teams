import {z} from 'zod'

/**
 * Platform enum for content targeting.
 */
export const platformSchema = z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])

/**
 * Review status for content items in the review queue.
 */
export const reviewStatusSchema = z.enum(['pending', 'approved', 'edited', 'rejected'])

/**
 * Content type classification per FR33.
 */
export const contentTypeSchema = z.enum(['standard', 'trending-derivative', 'retry', 'compliance-flagged'])

/**
 * User feedback on a review item (populated by Story 5.2).
 */
export const userFeedbackSchema = z.object({
  decision: reviewStatusSchema,
  reason: z.string().optional(),
  notes: z.string().optional(),
  editedAt: z.string().datetime().optional(),
})

/**
 * A single edit history entry tracking field-level changes.
 */
export const editHistoryEntrySchema = z.object({
  timestamp: z.string().datetime(),
  field: z.string(),
  originalValue: z.string(),
  newValue: z.string(),
})

/**
 * Full review item schema for validating items at deserialization boundary.
 * Covers FR29, FR32, FR33 requirements.
 */
export const reviewItemSchema = z.object({
  /** Generated ID, e.g. "item-2026-03-01-001" */
  id: z.string().min(1),
  /** UUID linking to PipelineRun */
  runId: z.string().uuid(),
  /** Target platform */
  platform: platformSchema,
  /** Current review status */
  status: reviewStatusSchema,
  /** Content payload */
  content: z.object({
    title: z.string().optional(),
    body: z.string().min(1),
    hashtags: z.array(z.string()).optional(),
    hooks: z.array(z.string()).optional(),
    cta: z.string().optional(),
    platformMeta: z.record(z.string(), z.unknown()),
  }),
  /** Quality score 0-1 from brand-guardian agent */
  qualityScore: z.number().min(0).max(1),
  /** Compliance flags from compliance/fact-checker agents */
  complianceFlags: z.array(z.string()),
  /** Content type tag per FR33 */
  contentType: contentTypeSchema,
  /** Agent name that created the content */
  generatedBy: z.string().min(1),
  /** ISO 8601 generation timestamp */
  generatedAt: z.string().datetime(),
  /** ISO 8601 scheduled publish time */
  scheduledTime: z.string().datetime().optional(),
  /** User feedback (populated by Story 5.2) */
  userFeedback: userFeedbackSchema.optional(),
  /** Edit history (populated by Story 5.2) */
  editHistory: z.array(editHistoryEntrySchema),
  /** ISO 8601 creation timestamp */
  createdAt: z.string().datetime(),
  /** ISO 8601 last update timestamp */
  updatedAt: z.string().datetime(),
})

export type ReviewItemData = z.infer<typeof reviewItemSchema>

/**
 * Review filter schema for validating filter parameters.
 */
export const reviewFilterSchema = z.object({
  platform: platformSchema.optional(),
  status: reviewStatusSchema.optional(),
  contentType: contentTypeSchema.optional(),
  runId: z.string().optional(),
  qualityAbove: z.number().min(0).max(1).optional(),
})

export type ReviewFilterData = z.infer<typeof reviewFilterSchema>
