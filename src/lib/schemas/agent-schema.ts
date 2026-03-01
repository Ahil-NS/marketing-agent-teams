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
      platform: z.string(),
      description: z.string(),
      engagementMetrics: z.object({
        source: z.string(),
        recency: z.string(),
        volume: z.number().optional(),
      }),
      trajectory: z.enum(['emerging', 'peaking', 'declining']),
      relevanceScore: z.number().min(1).max(5),
    }),
  ),
  viralPatterns: z.array(
    z.object({
      pattern: z.string(),
      platforms: z.array(z.string()),
      format: z.string(),
      examples: z.array(z.string()).optional(),
    }),
  ),
  opportunities: z.array(
    z.object({
      description: z.string(),
      relevanceScore: z.number().min(1).max(5),
      timelinessScore: z.number().min(1).max(5),
      platforms: z.array(z.string()),
      suggestedAngle: z.string(),
    }),
  ),
  risks: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      mitigation: z.string(),
    }),
  ),
  recommendations: z.string(),
})

export type TrendBrief = z.infer<typeof trendBriefSchema>

export const competitorReportSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      platforms: z.array(
        z.object({
          platform: z.string(),
          handle: z.string().optional(),
          followerCount: z.number().optional(),
          postingFrequency: z.string(),
          engagementRate: z.string(),
          contentTypes: z.array(z.string()),
        }),
      ),
    }),
  ),
  contentAnalysis: z.array(
    z.object({
      competitor: z.string(),
      topPerformingContent: z.array(
        z.object({
          platform: z.string(),
          description: z.string(),
          engagementSignals: z.string(),
          format: z.string(),
        }),
      ),
    }),
  ),
  viralContent: z.array(
    z.object({
      competitor: z.string(),
      platform: z.string(),
      description: z.string(),
      whyViral: z.string(),
      replicabilityScore: z.number().min(1).max(5),
    }),
  ),
  gaps: z.array(
    z.object({
      area: z.string(),
      description: z.string(),
      opportunity: z.string(),
    }),
  ),
  recommendations: z.string(),
})

export type CompetitorReport = z.infer<typeof competitorReportSchema>

export const researchInputsSchema = z.object({
  brandName: z.string().min(1),
  productDomain: z.string().min(1),
  audienceType: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
  trendTimeframeDays: z.number().int().positive().optional(),
})

/** Use ResearchInputs from src/lib/agents/types.ts for TypeScript typing.
 * This schema is for runtime validation of agent inputs. */
export type ResearchInputsData = z.infer<typeof researchInputsSchema>

export const viralPatternReportSchema = z.object({
  viralPatterns: z.array(z.object({
    platform: z.string(),
    pattern: z.string(),
    description: z.string(),
    frequency: z.enum(['rare', 'occasional', 'common', 'dominant']),
    examples: z.array(z.string()).optional(),
    replicabilityScore: z.number().min(1).max(5),
  })).min(1),
  hookAnalysis: z.array(z.object({
    hookType: z.string(),
    platform: z.string(),
    description: z.string(),
    effectiveness: z.enum(['low', 'medium', 'high', 'very-high']),
    examples: z.array(z.string()).optional(),
  })).min(1),
  captionStyles: z.array(z.object({
    platform: z.string(),
    style: z.string(),
    description: z.string(),
    languagePatterns: z.array(z.string()),
    engagementImpact: z.string(),
  })),
  hashtagStrategies: z.array(z.object({
    platform: z.string(),
    strategy: z.string(),
    recommendedCount: z.number(),
    hashtagTypes: z.array(z.string()),
    examples: z.array(z.string()).optional(),
  })),
  timingInsights: z.array(z.object({
    platform: z.string(),
    bestDays: z.array(z.string()),
    bestHours: z.array(z.string()),
    timezone: z.string(),
    rationale: z.string(),
  })),
  recommendations: z.string(),
})

export type ViralPatternReport = z.infer<typeof viralPatternReportSchema>

export const platformAlgorithmReportSchema = z.object({
  platforms: z.array(z.object({
    name: z.string(),
    lastUpdated: z.string(),
    overallStrategy: z.string(),
  })),
  algorithmPriorities: z.array(z.object({
    platform: z.string(),
    priority: z.string(),
    weight: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    recentChanges: z.string().optional(),
  })).min(1),
  rankingSignals: z.array(z.object({
    platform: z.string(),
    signal: z.string(),
    impact: z.enum(['negative', 'neutral', 'positive', 'strong-positive']),
    description: z.string(),
    actionable: z.boolean(),
  })).min(1),
  optimizationStrategies: z.array(z.object({
    platform: z.string(),
    strategy: z.string(),
    description: z.string(),
    expectedImpact: z.enum(['low', 'medium', 'high']),
    implementation: z.string(),
    antiPatterns: z.array(z.string()).optional(),
  })).min(1),
  recommendations: z.string(),
})

export type PlatformAlgorithmReport = z.infer<typeof platformAlgorithmReportSchema>

export const verticalDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  complianceRules: z.array(z.string()).default([]),
  knowledgeFiles: z.array(z.string()).default([]),
})

export type VerticalDefinitionData = z.infer<typeof verticalDefinitionSchema>
