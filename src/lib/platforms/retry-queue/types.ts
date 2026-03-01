import {z} from 'zod'

/** Valid retry item states */
export const RETRY_ITEM_STATES = ['pending', 'failed'] as const
export type RetryItemState = (typeof RETRY_ITEM_STATES)[number]

/** Default maximum retry attempts before marking as failed */
export const DEFAULT_MAX_ATTEMPTS = 10

/** Zod schema for the error details stored with a retry queue item */
export const retryErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  classification: z.enum(['transient', 'permanent']),
})

export type RetryErrorDetail = z.infer<typeof retryErrorDetailSchema>

/** Zod schema for platform content stored in retry queue items */
export const retryPlatformContentSchema = z.object({
  itemId: z.string(),
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  content: z.object({
    title: z.string().optional(),
    body: z.string(),
    hashtags: z.array(z.string()).optional(),
    media: z
      .array(
        z.object({
          type: z.enum(['image', 'video', 'carousel']),
          url: z.string().optional(),
          prompt: z.string().optional(),
          altText: z.string().optional(),
        }),
      )
      .optional(),
    platformMeta: z.record(z.string(), z.unknown()),
  }),
  scheduledTime: z.string().optional(),
})

/** Zod schema for a retry queue item persisted on disk */
export const retryQueueItemSchema = z.object({
  itemId: z.string(),
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  content: retryPlatformContentSchema,
  state: z.enum(['pending', 'failed']),
  error: retryErrorDetailSchema,
  attemptCount: z.number().int().min(0),
  maxAttempts: z.number().int().min(1).default(DEFAULT_MAX_ATTEMPTS),
  firstFailedAt: z.string(),
  lastAttemptAt: z.string(),
  nextRetryAt: z.string(),
  resolution: z.string().nullable(),
})

export type RetryQueueItem = z.infer<typeof retryQueueItemSchema>

/** Zod schema for the result of processing retries */
export const retryResultSchema = z.object({
  succeeded: z.array(z.string()),
  failed: z.array(z.string()),
  skipped: z.array(z.string()),
  errors: z.array(z.unknown()),
})

export type RetryProcessResult = z.infer<typeof retryResultSchema>

/** Per-platform breakdown for status reporting */
export interface PlatformRetryBreakdown {
  pending: number
  failed: number
}

/** Retry queue status for `mat status` reporting (AC6) */
export interface RetryQueueStatus {
  pendingCount: number
  failedCount: number
  byPlatform: Record<string, PlatformRetryBreakdown>
  nextRetryAt: string | null
}
