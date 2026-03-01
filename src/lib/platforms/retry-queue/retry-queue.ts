import {mkdir, readdir, readFile, rename, rm, unlink, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {AdapterRegistry} from '../adapter-registry.js'
import {classifyError, classifyNetworkError} from '../error-classifier.js'
import type {PlatformContent, PlatformName} from '../types.js'
import {RetryItemNotFoundError, RetryQueueError} from './errors.js'
import {
  DEFAULT_MAX_ATTEMPTS,
  retryQueueItemSchema,
  type RetryErrorDetail,
  type RetryProcessResult,
  type RetryQueueItem,
  type RetryQueueStatus,
} from './types.js'

/** Options for creating a RetryQueue instance */
export interface RetryQueueOptions {
  /** Base directory for .mat state (e.g., `/path/to/project/.mat`) */
  matDir: string
  /** Default max attempts before marking as failed (default: 10) */
  maxAttempts?: number
}

/**
 * Persistent retry queue for failed publish attempts.
 *
 * Items are stored as individual JSON files in `.mat/state/retry-queue/<item-id>.json`.
 * All writes are atomic (write to `.tmp`, then rename) to prevent corruption on crash.
 * Corrupted files are logged and skipped, never crashing the queue.
 */
export class RetryQueue {
  private readonly queueDir: string
  private readonly maxAttempts: number

  constructor(options: RetryQueueOptions) {
    this.queueDir = join(options.matDir, 'state', 'retry-queue')
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  }

  /**
   * Enqueue a failed publish attempt for later retry (AC1).
   * Performs an atomic write (write .tmp, then rename) for crash safety (NFR13).
   */
  async enqueue(
    content: PlatformContent,
    error: RetryErrorDetail,
    now?: Date,
  ): Promise<void> {
    await mkdir(this.queueDir, {recursive: true})

    const timestamp = (now ?? new Date()).toISOString()
    const nextRetryAt = this.calculateNextRetryAt(1, now)

    const item: RetryQueueItem = {
      itemId: content.itemId,
      platform: content.platform,
      content,
      state: 'pending',
      error,
      attemptCount: 1,
      maxAttempts: this.maxAttempts,
      firstFailedAt: timestamp,
      lastAttemptAt: timestamp,
      nextRetryAt,
      resolution: null,
    }

    await this.atomicWrite(item)
  }

  /**
   * Load all retry queue items from disk (AC2).
   * Corrupted files are skipped with a warning — never crashes.
   * Stale .tmp files from interrupted writes are cleaned up.
   */
  async loadAll(): Promise<RetryQueueItem[]> {
    await mkdir(this.queueDir, {recursive: true})

    let files: string[]
    try {
      files = await readdir(this.queueDir)
    } catch {
      return []
    }

    // Clean up stale .tmp files from previous crashes
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'))
    for (const tmpFile of tmpFiles) {
      try {
        await unlink(join(this.queueDir, tmpFile))
      } catch {
        // ignore cleanup failures
      }
    }

    const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
    const items: RetryQueueItem[] = []

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(this.queueDir, file), 'utf-8')
        const parsed = JSON.parse(raw) as unknown
        const result = retryQueueItemSchema.safeParse(parsed)
        if (result.success) {
          items.push(result.data)
        } else {
          // Corrupted file — log and skip (AC2 crash resilience)
          console.warn(`[retry-queue] Skipping corrupted file ${file}: ${result.error.message}`)
        }
      } catch (err) {
        // Unreadable/unparseable — skip
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[retry-queue] Skipping unreadable file ${file}: ${msg}`)
      }
    }

    return items
  }

  /**
   * Get a single retry queue item by ID.
   * Throws RetryItemNotFoundError if not found.
   */
  async getById(itemId: string): Promise<RetryQueueItem> {
    this.validateItemId(itemId)

    const filePath = join(this.queueDir, `${itemId}.json`)
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      const result = retryQueueItemSchema.safeParse(parsed)
      if (!result.success) {
        throw new RetryQueueError(
          `Corrupted retry item '${itemId}'`,
          `Zod validation failed: ${result.error.message}`,
        )
      }

      return result.data
    } catch (err) {
      if (err instanceof RetryQueueError) throw err
      throw new RetryItemNotFoundError(itemId)
    }
  }

  /**
   * Remove a retry item from the queue (after successful publish).
   */
  async remove(itemId: string): Promise<void> {
    this.validateItemId(itemId)

    const filePath = join(this.queueDir, `${itemId}.json`)
    try {
      await rm(filePath)
    } catch {
      throw new RetryItemNotFoundError(itemId)
    }
  }

  /**
   * Process all pending retries using the given adapter registry (AC3, AC4, AC5).
   *
   * - Only retries items where `nextRetryAt <= now` (respects backoff timing)
   * - On success: removes item from queue
   * - On transient failure: increments attempt count, updates next retry time
   * - On permanent failure: moves to `failed` state with resolution instructions
   * - On max retries exceeded: moves to `failed` state with "max retries exceeded" reason
   */
  async processRetries(
    adapters: AdapterRegistry,
    now?: Date,
  ): Promise<RetryProcessResult> {
    const currentTime = now ?? new Date()
    const items = await this.loadAll()
    const pendingItems = items.filter((item) => item.state === 'pending')

    const result: RetryProcessResult = {
      succeeded: [],
      failed: [],
      skipped: [],
      errors: [],
    }

    for (const item of pendingItems) {
      // Respect backoff timing — skip items not yet due (AC3)
      if (new Date(item.nextRetryAt) > currentTime) {
        result.skipped.push(item.itemId)
        continue
      }

      // Check max retries before attempting (AC5)
      if (item.attemptCount >= item.maxAttempts) {
        await this.markFailed(item, 'Max retries exceeded', currentTime)
        result.failed.push(item.itemId)
        continue
      }

      try {
        // Look up adapter; if not registered, skip
        if (!adapters.has(item.platform)) {
          result.skipped.push(item.itemId)
          result.errors.push(
            new RetryQueueError(
              `No adapter for platform '${item.platform}'`,
              `Cannot retry item '${item.itemId}' — platform adapter not registered`,
            ),
          )
          continue
        }

        const adapter = adapters.get(item.platform)
        const publishResult = await adapter.publish(item.content)

        if (publishResult.success) {
          // Success — remove from queue (AC3)
          await this.remove(item.itemId)
          result.succeeded.push(item.itemId)
        } else {
          // Publish returned failure via result (not exception)
          const errorDetail: RetryErrorDetail = publishResult.error
            ? {
                code: publishResult.error.code,
                message: publishResult.error.message,
                classification: publishResult.error.classification,
              }
            : {code: 'UNKNOWN', message: 'Publish returned failure without error details', classification: 'transient'}

          const markedFailed = await this.handleRetryFailure(item, errorDetail, currentTime)
          if (markedFailed) {
            result.failed.push(item.itemId)
          }
        }
      } catch (err) {
        // Exception during publish — classify and handle
        const errorDetail = this.classifyException(item.platform, err)
        const markedFailed = await this.handleRetryFailure(item, errorDetail, currentTime)
        result.errors.push(err)

        if (markedFailed) {
          result.failed.push(item.itemId)
        }
      }
    }

    return result
  }

  /**
   * Get retry queue status for `mat status` reporting (AC6).
   */
  async getQueueStatus(): Promise<RetryQueueStatus> {
    const items = await this.loadAll()

    let pendingCount = 0
    let failedCount = 0
    let earliestNextRetry: string | null = null
    const byPlatform: Record<string, {pending: number; failed: number}> = {}

    for (const item of items) {
      const platformKey = item.platform
      if (!byPlatform[platformKey]) {
        byPlatform[platformKey] = {pending: 0, failed: 0}
      }

      if (item.state === 'pending') {
        pendingCount++
        byPlatform[platformKey].pending++
        if (!earliestNextRetry || item.nextRetryAt < earliestNextRetry) {
          earliestNextRetry = item.nextRetryAt
        }
      } else {
        failedCount++
        byPlatform[platformKey].failed++
      }
    }

    return {
      pendingCount,
      failedCount,
      byPlatform,
      nextRetryAt: earliestNextRetry,
    }
  }

  /**
   * Purge all failed items from the queue (AC7 — `mat retry --purge-failed`).
   */
  async purgeFailed(): Promise<string[]> {
    const items = await this.loadAll()
    const failedItems = items.filter((item) => item.state === 'failed')
    const purged: string[] = []

    for (const item of failedItems) {
      try {
        await this.remove(item.itemId)
        purged.push(item.itemId)
      } catch {
        // Skip items that couldn't be removed
      }
    }

    return purged
  }

  // --- Internal helpers ---

  /**
   * Atomic write: write to .tmp file, then rename to final path.
   * This ensures crash safety — if process dies mid-write, the original file is untouched.
   */
  private async atomicWrite(item: RetryQueueItem): Promise<void> {
    const filePath = join(this.queueDir, `${item.itemId}.json`)
    const tmpPath = `${filePath}.tmp`
    const data = JSON.stringify(item, null, 2)
    await writeFile(tmpPath, data, 'utf-8')
    await rename(tmpPath, filePath)
  }

  /**
   * Handle a retry failure (transient or permanent).
   * - Transient: increment attempt count, update next retry time
   * - Permanent: move to failed state with resolution instructions
   *
   * Returns true if the item was moved to 'failed' state.
   */
  private async handleRetryFailure(
    item: RetryQueueItem,
    error: RetryErrorDetail,
    now: Date,
  ): Promise<boolean> {
    if (error.classification === 'permanent') {
      await this.markFailed(item, this.getResolutionMessage(item.platform, error), now)
      return true
    }

    // Transient — increment and reschedule
    const newAttemptCount = item.attemptCount + 1

    // Check if max retries exceeded after this attempt (AC5)
    if (newAttemptCount >= item.maxAttempts) {
      await this.markFailed(item, 'Max retries exceeded', now)
      return true
    }

    const updated: RetryQueueItem = {
      ...item,
      error,
      attemptCount: newAttemptCount,
      lastAttemptAt: now.toISOString(),
      nextRetryAt: this.calculateNextRetryAt(newAttemptCount, now),
    }

    await this.atomicWrite(updated)
    return false
  }

  /**
   * Mark an item as permanently failed with a resolution message (AC4).
   */
  private async markFailed(item: RetryQueueItem, resolution: string, now: Date): Promise<void> {
    const updated: RetryQueueItem = {
      ...item,
      state: 'failed',
      lastAttemptAt: now.toISOString(),
      resolution,
    }

    await this.atomicWrite(updated)
  }

  /**
   * Calculate the next retry timestamp using exponential backoff.
   * Base delay doubles with each attempt: 2s, 4s, 8s, 16s, ... capped at 600s (10 min).
   */
  private calculateNextRetryAt(attemptCount: number, now?: Date): string {
    const baseDelayMs = 2000
    const maxDelayMs = 600_000 // 10 minutes cap
    const delayMs = Math.min(baseDelayMs * Math.pow(2, attemptCount - 1), maxDelayMs)
    const nextTime = new Date((now ?? new Date()).getTime() + delayMs)
    return nextTime.toISOString()
  }

  /**
   * Classify an exception thrown during publish into a RetryErrorDetail.
   */
  private classifyException(platform: PlatformName, err: unknown): RetryErrorDetail {
    if (err && typeof err === 'object') {
      const statusCode = (err as Record<string, unknown>).statusCode ?? (err as Record<string, unknown>).status
      if (typeof statusCode === 'number') {
        const errorBody = (err as Record<string, unknown>).body ?? (err as Record<string, unknown>).message
        const classification = classifyError(
          platform,
          statusCode,
          typeof errorBody === 'string' ? errorBody : undefined,
        )
        return {
          code: String((err as Record<string, unknown>).code ?? 'PLATFORM_PUBLISH_FAILED'),
          message: err instanceof Error ? err.message : String(err),
          classification: classification.classification,
        }
      }

      // Network error (no status code)
      if (err instanceof Error) {
        const classification = classifyNetworkError(platform, err.message)
        return {
          code: 'PLATFORM_NETWORK_ERROR',
          message: err.message,
          classification: classification.classification,
        }
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: err instanceof Error ? err.message : String(err),
      classification: 'transient',
    }
  }

  /**
   * Generate a resolution message for permanently failed items (AC4).
   */
  private getResolutionMessage(platform: PlatformName, error: RetryErrorDetail): string {
    if (error.code === 'PLATFORM_AUTH_FAILED' || error.message.toLowerCase().includes('auth')) {
      return `Re-authenticate via 'mat config platforms add ${platform}'`
    }

    if (error.code === 'PLATFORM_CONTENT_POLICY' || error.message.toLowerCase().includes('policy')) {
      return `Review and edit content to comply with ${platform} guidelines. Run 'mat review' to modify.`
    }

    return `Permanent failure on ${platform}: ${error.message}. Check error details and resolve manually.`
  }

  /**
   * Validate an item ID to prevent path traversal.
   */
  private validateItemId(itemId: string): void {
    if (!itemId || itemId.includes('/') || itemId.includes('\\') || itemId.includes('..')) {
      throw new RetryQueueError(
        `Invalid item ID: '${itemId}'`,
        'Item ID must not contain path separators or traversal sequences',
      )
    }
  }
}
