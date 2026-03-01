import {z} from 'zod'

/**
 * Compliance violation type classifications.
 * Each represents a distinct regulatory or policy domain.
 */
export const complianceViolationTypeSchema = z.enum([
  'ftc-disclosure',
  'health-claims',
  'platform-policy',
  'copyright',
  'age-restriction',
  'financial-claims',
])

export type ComplianceViolationType = z.infer<typeof complianceViolationTypeSchema>

/**
 * A single compliance violation detected in content.
 * Each violation references the exact flagged text and the specific policy being violated.
 */
export const complianceViolationSchema = z.object({
  /** Unique ID for this violation within the report */
  id: z.string().min(1),
  /** Classification of the violation */
  type: complianceViolationTypeSchema,
  /** How severe the violation is */
  severity: z.enum(['critical', 'warning', 'info']),
  /** The exact text from the original content that triggers the violation */
  flaggedSection: z.string().min(1),
  /** Reference to the specific policy section being violated */
  policyReference: z.string().min(1),
  /** Which platform's policy applies */
  platform: z.string().min(1),
  /** Human-readable explanation of why this violates the policy */
  explanation: z.string().min(1),
})

export type ComplianceViolation = z.infer<typeof complianceViolationSchema>

/**
 * A suggested compliant rewrite for a detected violation.
 * Preserves original keywords and CTA intent while fixing compliance issues.
 */
export const complianceRewriteSchema = z.object({
  /** References the violation ID this rewrite addresses */
  violationId: z.string().min(1),
  /** Exact text from the original content being replaced */
  originalSection: z.string().min(1),
  /** Compliant replacement text */
  rewrittenSection: z.string().min(1),
  /** Keywords from the original that are preserved in the rewrite */
  preservedKeywords: z.array(z.string()),
  /** Whether the original call-to-action intent is preserved */
  preservedCta: z.boolean(),
  /** Explanation of what changed and why */
  explanation: z.string().min(1),
})

export type ComplianceRewrite = z.infer<typeof complianceRewriteSchema>

/**
 * Top-level compliance report — the agent's validated output.
 * Contains all violations, rewrites, and an overall compliance assessment.
 */
export const complianceReportSchema = z.object({
  /** Content item ID being evaluated */
  contentId: z.string().min(1),
  /** Platform this content targets */
  platform: z.string().min(1),
  /** Overall compliance status */
  overallStatus: z.enum(['compliant', 'violations-found', 'requires-review']),
  /** Compliance confidence score (0 = non-compliant, 100 = fully compliant) */
  complianceScore: z.number().min(0).max(100),
  /** All detected policy violations */
  violations: z.array(complianceViolationSchema),
  /** Suggested compliant rewrites for each violation */
  rewrites: z.array(complianceRewriteSchema),
  /** Health/wellness-specific flags (subset of violations with type='health-claims') */
  wellnessFlags: z.array(complianceViolationSchema),
  /** Human-readable summary of the compliance evaluation */
  summary: z.string().min(1),
})

export type ComplianceReport = z.infer<typeof complianceReportSchema>
