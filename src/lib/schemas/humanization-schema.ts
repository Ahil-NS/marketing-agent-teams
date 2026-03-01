import {z} from 'zod'

// --- Humanization Config Schema ---

export const humanizationConfigSchema = z.object({
  aiDetectionThreshold: z.number().min(0).max(100).default(20),
  enabledPlatforms: z.array(z.string()).optional(),
  bannedPhrases: z.array(z.string()).optional(),
  preserveKeywords: z.boolean().default(true),
})

export type HumanizationConfig = z.infer<typeof humanizationConfigSchema>

// --- Agent Output Schemas ---

export const aiMarkerRemovalSchema = z.object({
  marker: z.string(),
  location: z.string(),
  replacement: z.string(),
})

export type AiMarkerRemoval = z.infer<typeof aiMarkerRemovalSchema>

export const humanizationResultSchema = z.object({
  contentId: z.string().min(1),
  platform: z.enum(['tiktok', 'reddit', 'facebook', 'instagram']),
  originalText: z.string().min(1),
  humanizedText: z.string().min(1),
  aiMarkersRemoved: z.array(aiMarkerRemovalSchema),
  techniquesApplied: z.array(z.string()).min(1),
  estimatedAiScore: z.number().min(0).max(100),
  brandVoiceConsistency: z.number().min(0).max(100),
  meaningPreserved: z.boolean(),
})

export type HumanizationResult = z.infer<typeof humanizationResultSchema>

export const humanizationOutputSchema = z.object({
  items: z.array(humanizationResultSchema).min(1),
  summary: z.object({
    totalItems: z.number().int().min(1),
    averageAiScore: z.number().min(0).max(100),
    averageBrandVoiceScore: z.number().min(0).max(100),
    itemsBelowThreshold: z.number().int().min(0),
    itemsAboveThreshold: z.number().int().min(0),
  }),
})

export type HumanizationOutput = z.infer<typeof humanizationOutputSchema>
