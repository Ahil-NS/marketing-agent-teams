import {z} from 'zod'

/**
 * Schema for a factual claim extracted from content.
 */
export const factualClaimSchema = z.object({
  /** The exact claim text extracted from content */
  claimText: z.string().min(1),
  /** Type of factual claim */
  claimType: z.enum(['statistic', 'quote', 'historical', 'scientific', 'comparative', 'general']),
  /** Position in content text */
  location: z.object({
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(0),
  }),
})

/**
 * Schema for a verdict on a single factual claim.
 */
export const claimVerdictSchema = z.object({
  /** The claim being evaluated */
  claim: factualClaimSchema,
  /** Fact check result */
  verdict: z.enum(['verified', 'unverifiable', 'likely-accurate', 'likely-inaccurate', 'false']),
  /** Confidence in the verdict (0-100) */
  confidence: z.number().min(0).max(100),
  /** Supporting evidence or reasoning */
  evidence: z.string().min(1),
  /** Suggested replacement text if claim is inaccurate */
  suggestedAlternative: z.string().optional(),
  /** Suggested caveat to add (e.g., "according to...", "approximately...") */
  caveat: z.string().optional(),
  /** Sources consulted for verification */
  sources: z.array(z.string()),
})

/**
 * Schema for a complete fact check report on a content item.
 */
export const factCheckReportSchema = z.object({
  /** ID of the content item checked */
  contentItemId: z.string().min(1),
  /** Total claims identified */
  claimsFound: z.number().int().min(0),
  /** Verdict for each claim */
  verdicts: z.array(claimVerdictSchema),
  /** Aggregate accuracy score (0-100) */
  overallAccuracy: z.number().min(0).max(100),
  /** Overall recommendation */
  recommendation: z.enum(['pass', 'pass-with-caveats', 'needs-revision', 'block']),
  /** Brief summary of findings */
  summary: z.string().min(1),
})

/** Inferred type for a factual claim */
export type FactualClaim = z.infer<typeof factualClaimSchema>
/** Inferred type for a claim verdict */
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>
/** Inferred type for a fact check report */
export type FactCheckReport = z.infer<typeof factCheckReportSchema>
