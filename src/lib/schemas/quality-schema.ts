import {z} from 'zod'

export const brandGuardianReviewSchema = z.object({
  contentItemId: z.string().min(1),
  qualityScore: z.number().min(0).max(100),
  toneAlignment: z.number().min(0).max(100),
  styleConsistency: z.number().min(0).max(100),
  principleAdherence: z.number().min(0).max(100),
  bannedPhraseViolations: z.array(z.string()),
  issues: z.array(
    z.object({
      category: z.enum(['tone', 'style', 'principle', 'banned-phrase', 'vocabulary', 'messaging']),
      description: z.string().min(1),
      severity: z.enum(['low', 'medium', 'high']),
      location: z.string().optional(),
    }),
  ),
  suggestions: z.array(
    z.object({
      issue: z.string().min(1),
      suggestedFix: z.string().min(1),
    }),
  ),
})

export type BrandGuardianReview = z.infer<typeof brandGuardianReviewSchema>

export const qualityGateResultSchema = z.object({
  contentItemId: z.string().min(1),
  qualityScore: z.number().min(0).max(100),
  threshold: z.number().min(0).max(100),
  passed: z.boolean(),
  blockedReasons: z.array(z.string()),
})

export type QualityGateResult = z.infer<typeof qualityGateResultSchema>

export const learnedPatternSchema = z.object({
  pattern: z.string().min(1),
  patternType: z.enum(['tone-correction', 'style-adjustment', 'phrase-replacement', 'structure-change']),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1),
})

export type LearnedPattern = z.infer<typeof learnedPatternSchema>

export const brandGuardianOutputSchema = z.object({
  reviews: z.array(brandGuardianReviewSchema).min(1),
  qualityGateResults: z.array(qualityGateResultSchema).min(1),
  overallAssessment: z.object({
    averageScore: z.number().min(0).max(100),
    totalReviewed: z.number().int().min(1),
    totalPassed: z.number().int().min(0),
    totalBlocked: z.number().int().min(0),
  }),
  learnedPatterns: z.array(learnedPatternSchema),
})

export type BrandGuardianOutput = z.infer<typeof brandGuardianOutputSchema>

export const brandGuardianInputsSchema = z.object({
  contentItems: z.array(z.object({
    id: z.string().min(1),
    platform: z.string().min(1),
    content: z.string().min(1),
  })).min(1),
  brandVoiceConfig: z.object({
    tone: z.string().min(1),
    communicationStyle: z.string().min(1),
    brandPrinciples: z.array(z.string()),
    bannedPhrases: z.array(z.string()),
    qualityThreshold: z.number().min(0).max(100).default(70),
  }),
  qualityThreshold: z.number().min(0).max(100),
})

export type BrandGuardianInputs = z.infer<typeof brandGuardianInputsSchema>
