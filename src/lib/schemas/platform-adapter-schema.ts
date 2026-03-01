import {z} from 'zod'

export const platformNameSchema = z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])

export const authResultSchema = z.object({
  success: z.boolean(),
  platform: platformNameSchema,
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
})

export const mediaAttachmentSchema = z.object({
  type: z.enum(['image', 'video', 'carousel']),
  url: z.string().url().optional(),
  prompt: z.string().optional(),
  altText: z.string().optional(),
})

export const platformContentSchema = z.object({
  itemId: z.string().min(1),
  platform: platformNameSchema,
  content: z.object({
    title: z.string().optional(),
    body: z.string(),
    hashtags: z.array(z.string()).optional(),
    media: z.array(mediaAttachmentSchema).optional(),
    platformMeta: z.record(z.string(), z.unknown()),
  }),
  scheduledTime: z.string().datetime().optional(),
})

export const platformPublishErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  classification: z.enum(['transient', 'permanent']),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().positive().optional(),
})

export const publishResultSchema = z.object({
  success: z.boolean(),
  platform: platformNameSchema,
  itemId: z.string().min(1),
  postId: z.string().optional(),
  postUrl: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
  error: platformPublishErrorSchema.optional(),
})

export const contentValidationErrorSchema = z.object({
  field: z.string(),
  constraint: z.string(),
  message: z.string(),
  value: z.unknown().optional(),
  limit: z.number().optional(),
})

export const contentValidationWarningSchema = z.object({
  field: z.string(),
  message: z.string(),
})

export const contentValidationResultSchema = z.object({
  valid: z.boolean(),
  platform: platformNameSchema,
  errors: z.array(contentValidationErrorSchema),
  warnings: z.array(contentValidationWarningSchema),
})

export const rateLimitStatusSchema = z.object({
  platform: platformNameSchema,
  remaining: z.number().int().min(0),
  limit: z.number().int().positive(),
  resetsAt: z.string().datetime(),
  windowType: z.enum(['minute', 'hour', 'day']),
})

export const platformMetricsSchema = z.object({
  postId: z.string().min(1),
  platform: platformNameSchema,
  views: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  engagementRate: z.number().min(0).max(1).optional(),
  retrievedAt: z.string().datetime(),
})

export type PlatformNameData = z.infer<typeof platformNameSchema>
export type AuthResultData = z.infer<typeof authResultSchema>
export type MediaAttachmentData = z.infer<typeof mediaAttachmentSchema>
export type PlatformContentData = z.infer<typeof platformContentSchema>
export type PlatformPublishErrorData = z.infer<typeof platformPublishErrorSchema>
export type PublishResultData = z.infer<typeof publishResultSchema>
export type ContentValidationErrorData = z.infer<typeof contentValidationErrorSchema>
export type ContentValidationWarningData = z.infer<typeof contentValidationWarningSchema>
export type ContentValidationResultData = z.infer<typeof contentValidationResultSchema>
export type RateLimitStatusData = z.infer<typeof rateLimitStatusSchema>
export type PlatformMetricsData = z.infer<typeof platformMetricsSchema>
