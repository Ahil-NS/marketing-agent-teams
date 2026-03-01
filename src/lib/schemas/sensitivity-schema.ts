import {z} from 'zod'

/**
 * Schema for a sensitivity flag on a piece of content.
 */
export const sensitivityFlagSchema = z.object({
  /** The flagged text excerpt */
  flaggedText: z.string().min(1),
  /** Sensitivity category */
  category: z.enum([
    'cultural', 'political', 'religious', 'gender', 'racial',
    'ableist', 'ageist', 'sexual', 'violence', 'profanity', 'controversial',
  ]),
  /** Severity rating */
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  /** Why this was flagged */
  explanation: z.string().min(1),
  /** Suggested alternative phrasing */
  suggestedRevision: z.string().optional(),
  /** Position in content */
  location: z.object({
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(0),
  }),
})

/**
 * Schema for a complete sensitivity report on a content item.
 */
export const sensitivityReportSchema = z.object({
  /** ID of the content item reviewed */
  contentItemId: z.string().min(1),
  /** All sensitivity flags */
  flags: z.array(sensitivityFlagSchema),
  /** Highest severity found */
  overallSeverity: z.enum(['critical', 'high', 'medium', 'low', 'clear']),
  /** Overall recommendation */
  recommendation: z.enum(['pass', 'pass-with-warnings', 'needs-revision', 'block']),
  /** Brief summary of findings */
  summary: z.string().min(1),
})

/** Inferred type for a sensitivity flag */
export type SensitivityFlag = z.infer<typeof sensitivityFlagSchema>
/** Inferred type for a sensitivity report */
export type SensitivityReport = z.infer<typeof sensitivityReportSchema>
