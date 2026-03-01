import {existsSync} from 'node:fs'
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises'
import {dirname} from 'node:path'

import type {PlatformName} from '../platforms/types.js'

import type {ViralTrackingState} from './viral-types.js'
import {viralTrackingStateSchema} from './viral-types.js'

/**
 * Tracks which posts have already triggered viral derivative spawning
 * to prevent duplicate processing. Persists state to
 * `.mat/state/viral-tracking.json` using atomic writes.
 *
 * Key format: `"<platform>:<postId>"` — guarantees uniqueness across platforms.
 */
export class ViralTracker {
  private state: ViralTrackingState = {processedPosts: {}}

  constructor(private readonly trackingPath: string) {}

  /**
   * Load tracking state from disk. If the file doesn't exist, starts fresh.
   * Validates with Zod at the deserialization boundary.
   * @throws Error if the file exists but contains invalid data.
   */
  async load(): Promise<void> {
    if (!existsSync(this.trackingPath)) {
      this.state = {processedPosts: {}}
      return
    }

    const raw = await readFile(this.trackingPath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    const result = viralTrackingStateSchema.safeParse(parsed)

    if (!result.success) {
      throw new Error(`Corrupt viral tracking state at ${this.trackingPath}: ${result.error.message}`)
    }

    this.state = result.data
  }

  /**
   * Check whether a given post has already been processed for viral derivative spawning.
   */
  hasBeenProcessed(platform: PlatformName, postId: string): boolean {
    return `${platform}:${postId}` in this.state.processedPosts
  }

  /**
   * Mark a post as processed. Persists immediately via atomic write.
   */
  async markProcessed(
    platform: PlatformName,
    postId: string,
    detectedAt: string,
    taskId: string,
  ): Promise<void> {
    this.state.processedPosts[`${platform}:${postId}`] = {
      detectedAt,
      derivativeTaskId: taskId,
    }
    await this.save()
  }

  /**
   * Get the number of posts currently tracked.
   */
  getProcessedCount(): number {
    return Object.keys(this.state.processedPosts).length
  }

  /**
   * Atomic write: write to `.tmp`, then rename.
   * Consistent with the retry queue and review queue persistence patterns.
   */
  private async save(): Promise<void> {
    const dir = dirname(this.trackingPath)
    if (!existsSync(dir)) {
      await mkdir(dir, {recursive: true})
    }

    const tmpPath = `${this.trackingPath}.tmp`
    await writeFile(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8')
    await rename(tmpPath, this.trackingPath)
  }
}
