import {z} from 'zod'

export const pipelineStageSchema = z.enum([
  'research',
  'strategy',
  'creation',
  'optimization',
  'quality',
  'review',
  'distribution',
])

export const stageStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'paused',
])

export const pipelineRunStatusSchema = z.enum([
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
])

export const pipelineErrorSchema = z.object({
  stage: pipelineStageSchema,
  code: z.string().min(1),
  message: z.string().min(1),
  reason: z.string().min(1),
  resolution: z.string().min(1),
  severity: z.enum(['transient', 'permanent']),
  timestamp: z.string().datetime(),
})

export const stageResultSchema = z.object({
  status: stageStatusSchema,
  agentResults: z.record(z.string(), z.unknown()),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  error: pipelineErrorSchema.optional(),
})

export const pipelineRunSchema = z.object({
  id: z.string().uuid(),
  status: pipelineRunStatusSchema,
  currentStage: pipelineStageSchema,
  stages: z.record(pipelineStageSchema, stageResultSchema),
  budget: z.object({
    spent: z.number().min(0),
    limit: z.number().min(0),
    currency: z.literal('USD'),
  }),
  config: z.object({
    platforms: z.array(z.string().min(1)),
    dryRun: z.boolean(),
  }),
  errors: z.array(pipelineErrorSchema),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
})

export type PipelineRunData = z.infer<typeof pipelineRunSchema>
