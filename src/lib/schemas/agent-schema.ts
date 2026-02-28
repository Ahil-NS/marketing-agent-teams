import {z} from 'zod'

/**
 * Known Agent SDK built-in tools.
 * This is the authoritative allowlist — tools not in this list are rejected at schema validation time.
 */
export const VALID_SDK_TOOLS = [
  'WebSearch',
  'WebFetch',
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'Task',
] as const

/**
 * Known data scope identifiers.
 * Agents declare which data stores they need access to — permission enforcer validates against this list.
 */
export const VALID_DATA_SCOPES = [
  'pipeline-state',
  'brand-config',
  'agent-memory',
  'content-items',
  'review-queue',
  'platform-metrics',
] as const

export const exampleInputsSchema = z.object({
  description: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
})

export const permissionsBlockSchema = z.object({
  credentials: z.array(z.string()).default([]),
  dataScopes: z.array(z.enum(VALID_DATA_SCOPES)).default([]),
  toolScopes: z.array(z.enum(VALID_SDK_TOOLS)).default([]),
}).default({
  credentials: [],
  dataScopes: [],
  toolScopes: [],
})

/** @deprecated Use permissionsBlockSchema instead */
export const skillPermissionsSchema = permissionsBlockSchema

export type PermissionsBlock = z.infer<typeof permissionsBlockSchema>

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
  trustTier: z.enum(['builtin', 'verified', 'community']).default('builtin'),
  permissions: permissionsBlockSchema,
  examples: z.array(exampleInputsSchema).optional(),
}).refine(
  (data) => data.permissions.toolScopes.every((scope) => data.tools.includes(scope)),
  {message: 'permissions.toolScopes must be a subset of tools — all tool scopes must be declared in the tools array'},
)

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
