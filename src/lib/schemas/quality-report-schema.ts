import {z} from 'zod'

import {factCheckReportSchema} from './fact-check-schema.js'
import {sensitivityReportSchema} from './sensitivity-schema.js'

/**
 * Schema for a combined quality report aggregating all quality agent outputs.
 * Used by the quality gate evaluator to make pass/block decisions.
 */
export const combinedQualityReportSchema = z.object({
  /** ID of the content item */
  contentItemId: z.string().min(1),
  /** Fact check report — may not run if no factual claims */
  factCheckReport: factCheckReportSchema.optional(),
  /** Sensitivity report — may not run if content is clean */
  sensitivityReport: sensitivityReportSchema.optional(),
  /** Brand guardian report from Story 4.4 (referenced, not redefined) */
  brandGuardianReport: z.unknown().optional(),
  /** Compliance report from Story 4.5 (referenced, not redefined) */
  complianceReport: z.unknown().optional(),
  /** Overall quality gate recommendation */
  overallRecommendation: z.enum(['pass', 'pass-with-warnings', 'needs-revision', 'block']),
  /** Reasons for blocking (if blocked) */
  blockReasons: z.array(z.string()),
  /** Non-blocking warnings attached to content */
  warnings: z.array(z.string()),
})

/** Inferred type for a combined quality report */
export type CombinedQualityReport = z.infer<typeof combinedQualityReportSchema>
