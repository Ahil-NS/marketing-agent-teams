import {z} from 'zod'

const platformSchema = z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])

export const brandVoiceSchema = z.object({
  tone: z.string().min(1).default('professional'),
  communicationStyle: z.string().min(1).default('clear and direct'),
  brandPrinciples: z.array(z.string().min(1)).default([]),
  bannedPhrases: z.array(z.string().min(1)).default([]),
}).default({
  tone: 'professional',
  communicationStyle: 'clear and direct',
  brandPrinciples: [],
  bannedPhrases: [],
})

export type BrandVoiceConfig = z.infer<typeof brandVoiceSchema>

const agentsSchema = z.object({
  defaultModel: z.string().default('sonnet'),
  budgetLimit: z.number().min(0).default(10),
}).default({
  defaultModel: 'sonnet',
  budgetLimit: 10,
})

export const configSchema = z.object({
  productName: z.string().min(1),
  platforms: z.array(platformSchema).min(1),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  brandVoice: brandVoiceSchema,
  agents: agentsSchema,
})

export type Config = z.infer<typeof configSchema>
