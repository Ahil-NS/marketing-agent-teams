import {readdir, readFile, writeFile, mkdir, rename} from 'node:fs/promises'
import {join} from 'node:path'

import {reviewItemSchema} from '../schemas/review-schema.js'

import {InvalidStatusTransitionError, ReviewItemNotFoundError} from './errors.js'
import type {EditHistoryEntry, ReviewFilter, ReviewItem, ReviewQueueStats, ReviewStatus} from './types.js'

/** Statuses that allow transitions to approve/reject/edit */
const ACTIONABLE_STATUSES = new Set<ReviewStatus>(['pending', 'edited'])

/**
 * Manages the review queue stored as individual JSON files in .mat/state/review-queue/.
 * Always reads fresh from disk on list() — no in-memory caching.
 */
export class ReviewQueue {
  private readonly queueDir: string

  constructor(projectRoot: string) {
    this.queueDir = join(projectRoot, '.mat', 'state', 'review-queue')
  }

  /**
   * List all review items, optionally filtered.
   * Items are sorted by platform (alphabetical), then by status.
   * Invalid files are skipped with a warning logged to stderr.
   */
  async list(filter?: ReviewFilter): Promise<ReviewItem[]> {
    let files: string[]
    try {
      files = await readdir(this.queueDir)
    } catch {
      // Directory doesn't exist — queue is empty
      return []
    }

    const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
    const items: ReviewItem[] = []

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(this.queueDir, file), 'utf-8')
        const parsed = JSON.parse(raw) as unknown
        const result = reviewItemSchema.safeParse(parsed)
        if (result.success) {
          items.push(result.data as ReviewItem)
        } else {
          process.stderr.write(`Warning: Skipping invalid review item ${file}\n`)
        }
      } catch {
        process.stderr.write(`Warning: Failed to read review item ${file}\n`)
      }
    }

    // Apply filters
    let filtered = items
    if (filter) {
      if (filter.platform) {
        filtered = filtered.filter((item) => item.platform === filter.platform)
      }

      if (filter.status) {
        filtered = filtered.filter((item) => item.status === filter.status)
      }

      if (filter.contentType) {
        filtered = filtered.filter((item) => item.contentType === filter.contentType)
      }

      if (filter.runId) {
        filtered = filtered.filter((item) => item.runId === filter.runId)
      }
    }

    // Sort by platform (alphabetical), then by status
    const statusOrder: Record<string, number> = {pending: 0, approved: 1, edited: 2, rejected: 3}
    filtered.sort((a, b) => {
      const platformCmp = a.platform.localeCompare(b.platform)
      if (platformCmp !== 0) return platformCmp
      return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
    })

    return filtered
  }

  /**
   * Get a single review item by ID.
   * @throws ReviewItemNotFoundError if item doesn't exist or is invalid.
   */
  async getById(itemId: string): Promise<ReviewItem> {
    const filePath = join(this.queueDir, `${itemId}.json`)
    let raw: string
    try {
      raw = await readFile(filePath, 'utf-8')
    } catch {
      throw new ReviewItemNotFoundError(itemId)
    }

    const parsed = JSON.parse(raw) as unknown
    const result = reviewItemSchema.safeParse(parsed)
    if (!result.success) {
      throw new ReviewItemNotFoundError(itemId)
    }

    return result.data as ReviewItem
  }

  /**
   * Enqueue review items using atomic writes (write .tmp then rename).
   * Creates the queue directory if it doesn't exist.
   */
  async enqueue(items: ReviewItem[]): Promise<void> {
    await mkdir(this.queueDir, {recursive: true})

    for (const item of items) {
      // Validate before writing
      const result = reviewItemSchema.safeParse(item)
      if (!result.success) {
        throw new Error(`Invalid review item: ${item.id}`)
      }

      const filePath = join(this.queueDir, `${item.id}.json`)
      const tmpPath = `${filePath}.tmp`
      await writeFile(tmpPath, JSON.stringify(item, null, 2), 'utf-8')
      await rename(tmpPath, filePath)
    }
  }

  /**
   * Get aggregate statistics for the review queue.
   */
  async getStats(): Promise<ReviewQueueStats> {
    const items = await this.list()
    const stats: ReviewQueueStats = {
      pending: 0,
      approved: 0,
      edited: 0,
      rejected: 0,
      total: items.length,
    }

    for (const item of items) {
      if (item.status in stats) {
        stats[item.status as keyof Omit<ReviewQueueStats, 'total'>]++
      }
    }

    return stats
  }

  /**
   * Approve a review item, marking it eligible for distribution (FR30).
   * Valid from: pending, edited. Invalid from: approved, rejected.
   * @throws ReviewItemNotFoundError if item doesn't exist.
   * @throws InvalidStatusTransitionError if current status cannot transition to approved.
   */
  async approve(itemId: string, notes?: string): Promise<ReviewItem> {
    const item = await this.getById(itemId)
    this.validateTransition(itemId, item.status, 'approved')

    item.status = 'approved'
    item.userFeedback = {
      decision: 'approved',
      notes,
      editedAt: new Date().toISOString(),
    }
    item.updatedAt = new Date().toISOString()
    await this.saveItem(item)
    return item
  }

  /**
   * Reject a review item with a reason (FR30, captures data for FR62).
   * Valid from: pending, edited. Invalid from: approved, rejected.
   * @throws ReviewItemNotFoundError if item doesn't exist.
   * @throws InvalidStatusTransitionError if current status cannot transition to rejected.
   */
  async reject(itemId: string, reason: string, feedback?: string): Promise<ReviewItem> {
    const item = await this.getById(itemId)
    this.validateTransition(itemId, item.status, 'rejected')

    item.status = 'rejected'
    item.userFeedback = {
      decision: 'rejected',
      reason,
      notes: feedback,
      editedAt: new Date().toISOString(),
    }
    item.updatedAt = new Date().toISOString()
    await this.saveItem(item)
    return item
  }

  /**
   * Edit a review item's content fields, preserving originals in editHistory.
   * Auto-approves after edit (status → approved). Valid from: pending, edited.
   * @throws ReviewItemNotFoundError if item doesn't exist.
   * @throws InvalidStatusTransitionError if current status cannot transition.
   */
  async edit(itemId: string, edits: Record<string, string>, notes?: string): Promise<ReviewItem> {
    const item = await this.getById(itemId)
    this.validateTransition(itemId, item.status, 'approved')

    const now = new Date().toISOString()

    // Preserve originals in editHistory and apply edits
    for (const [field, newValue] of Object.entries(edits)) {
      const originalValue = (item.content as unknown as Record<string, unknown>)[field]
      const entry: EditHistoryEntry = {
        timestamp: now,
        field,
        originalValue: typeof originalValue === 'string' ? originalValue : JSON.stringify(originalValue ?? ''),
        newValue,
      }
      item.editHistory.push(entry)
      ;(item.content as unknown as Record<string, unknown>)[field] = newValue
    }

    item.status = 'approved'
    item.userFeedback = {
      decision: 'approved',
      notes,
      editedAt: now,
    }
    item.updatedAt = now
    await this.saveItem(item)
    return item
  }

  /**
   * Validate a status transition. Only pending and edited statuses are actionable.
   * @throws InvalidStatusTransitionError if the transition is not allowed.
   */
  private validateTransition(itemId: string, currentStatus: ReviewStatus, targetStatus: ReviewStatus): void {
    if (!ACTIONABLE_STATUSES.has(currentStatus)) {
      throw new InvalidStatusTransitionError(itemId, currentStatus, targetStatus)
    }
  }

  /**
   * Persist a review item atomically: write to .tmp then rename.
   */
  private async saveItem(item: ReviewItem): Promise<void> {
    await mkdir(this.queueDir, {recursive: true})
    const filePath = join(this.queueDir, `${item.id}.json`)
    const tmpPath = `${filePath}.tmp`
    await writeFile(tmpPath, JSON.stringify(item, null, 2), 'utf-8')
    await rename(tmpPath, filePath)
  }
}
