import {z} from 'zod'

export const agentDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  cluster: z.enum([
    'intelligence',
    'strategy',
    'creation',
    'optimization',
    'quality',
    'distribution',
    'coordination',
  ]),
  model: z.enum(['haiku', 'sonnet']).default('haiku'),
  tools: z.array(z.string()).default([]),
  trustTier: z.enum(['builtin', 'reviewed', 'unreviewed']).default('builtin'),
})

export type AgentDefinition = z.infer<typeof agentDefinitionSchema>

export const trendBriefSchema = z.object({
  trends: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      relevance: z.number().min(0).max(1),
      source: z.string().optional(),
    }),
  ),
  viralPatterns: z.array(
    z.object({
      pattern: z.string(),
      platform: z.string(),
      examples: z.array(z.string()).optional(),
    }),
  ),
  opportunities: z.array(
    z.object({
      description: z.string(),
      platform: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
})

export type TrendBrief = z.infer<typeof trendBriefSchema>
