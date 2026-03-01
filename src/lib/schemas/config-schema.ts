import {z} from 'zod'

import {humanizationConfigSchema} from './humanization-schema.js'

const platformSchema = z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])

export const brandVoiceSchema = z.object({
  tone: z.string().min(1).default('professional'),
  communicationStyle: z.string().min(1).default('clear and direct'),
  brandPrinciples: z.array(z.string().min(1)).default([]),
  bannedPhrases: z.array(z.string().min(1)).default([]),
  qualityThreshold: z.number().min(0).max(100).default(70),
}).default({
  tone: 'professional',
  communicationStyle: 'clear and direct',
  brandPrinciples: [],
  bannedPhrases: [],
  qualityThreshold: 70,
})

export type BrandVoiceConfig = z.infer<typeof brandVoiceSchema>

export const agentToggleSchema = z.object({
  enabled: z.boolean().default(true),
})

export const agentTogglesSchema = z.record(
  z.string(),
  agentToggleSchema,
).default({})

export type AgentToggles = z.infer<typeof agentTogglesSchema>

const agentsSchema = z.object({
  defaultModel: z.string().default('sonnet'),
  budgetLimit: z.number().min(0).default(10),
  toggles: agentTogglesSchema,
}).default({
  defaultModel: 'sonnet',
  budgetLimit: 10,
  toggles: {},
})

const perPlatformThresholdSchema = z.object({
  reddit: z.number().min(0).max(1).optional(),
  tiktok: z.number().min(0).max(1).optional(),
  facebook: z.number().min(0).max(1).optional(),
  instagram: z.number().min(0).max(1).optional(),
}).default({})

export const viralThresholdSchema = z.object({
  default: z.number().min(0).max(1).default(0.75),
  perPlatform: perPlatformThresholdSchema,
  enabled: z.boolean().default(true),
}).default({
  default: 0.75,
  perPlatform: {},
  enabled: true,
})

export type ViralThreshold = z.infer<typeof viralThresholdSchema>

// ── Per-metric viral threshold config per platform (Story 6.8) ──────────────

const platformMetricThresholdSchema = z.object({
  engagementRate: z.number().min(0).max(1).optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
}).default({})

export const viralConfigSchema = z.object({
  enabled: z.boolean().default(true),
  thresholds: z.object({
    reddit: platformMetricThresholdSchema,
    tiktok: platformMetricThresholdSchema,
    facebook: platformMetricThresholdSchema,
    instagram: platformMetricThresholdSchema,
  }).default({
    reddit: {},
    tiktok: {},
    facebook: {},
    instagram: {},
  }),
}).default({
  enabled: true,
  thresholds: {
    reddit: {},
    tiktok: {},
    facebook: {},
    instagram: {},
  },
})

export type ViralConfig = z.infer<typeof viralConfigSchema>

const optimizationSchema = z.object({
  humanization: humanizationConfigSchema.default({
    aiDetectionThreshold: 20,
    preserveKeywords: true,
  }),
}).default({
  humanization: {
    aiDetectionThreshold: 20,
    preserveKeywords: true,
  },
})

export const configSchema = z.object({
  productName: z.string().min(1),
  platforms: z.array(platformSchema).min(1),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  brandVoice: brandVoiceSchema,
  agents: agentsSchema,
  viralThreshold: viralThresholdSchema,
  viral: viralConfigSchema,
  optimization: optimizationSchema,
  vertical: z.string().min(1).optional(),
})

export type Config = z.infer<typeof configSchema>
