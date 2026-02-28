import {z} from 'zod'

export const exampleInputsSchema = z.object({
  description: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
})

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
  examples: z.array(exampleInputsSchema).optional(),
})

export type AgentDefinition = z.infer<typeof agentDefinitionSchema>

export const memoryEntrySchema = z.object({
  id: z.string().uuid(),
  runId: z.string().min(1),
  timestamp: z.string().datetime(),
  type: z.enum(['learning', 'rejection', 'pattern', 'preference']),
  content: z.string().min(1),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
})

export type MemoryEntryValidated = z.infer<typeof memoryEntrySchema>

export const memoryStateSchema = z.object({
  agentName: z.string().min(1),
  lastRunId: z.string().nullable(),
  lastRunAt: z.string().datetime().nullable(),
  entries: z.array(memoryEntrySchema),
  metadata: z.record(z.string(), z.any()),
})

export type MemoryStateValidated = z.infer<typeof memoryStateSchema>

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
