import {z} from 'zod'

const platformSchema = z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])

const brandVoiceSchema = z.object({
  tone: z.string().default('professional'),
  style: z.string().default('conversational'),
  audience: z.string().default('general'),
}).default({
  tone: 'professional',
  style: 'conversational',
  audience: 'general',
})

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
