import {randomUUID} from 'node:crypto'

import type {PlatformName} from '../platforms/types.js'
import type {ReviewItem} from '../review-queue/types.js'

import type {BudgetTracker} from './budget-tracker.js'
import type {DerivativeMetadata, DerivativeTask, DerivationType, ViralDetectionResult} from './viral-types.js'

/** Platforms that a derivative can be repurposed to */
const ALL_PLATFORMS: readonly PlatformName[] = ['reddit', 'tiktok', 'facebook', 'instagram'] as const

/** Derivation type selection based on original platform  */
const DERIVATION_TYPE_MAP: Record<PlatformName, DerivationType> = {
  reddit: 'thread-expansion',
  tiktok: 'variation',
  facebook: 'repurpose',
  instagram: 'repurpose',
}

/**
 * Spawns derivative creation tasks for viral content.
 * Each viral detection produces one DerivativeTask targeting platforms
 * OTHER than the original (cross-platform repurposing).
 *
 * Tasks run in parallel (Promise.all) and do not block the standard pipeline.
 * Budget is checked BEFORE spawning — if exhausted, spawning is skipped.
 */
export function buildDerivativeTasks(
  viralResults: ViralDetectionResult[],
): DerivativeTask[] {
  const tasks: DerivativeTask[] = []

  for (const viral of viralResults) {
    const targetPlatforms = ALL_PLATFORMS.filter((p) => p !== viral.platform)
    const derivationType = DERIVATION_TYPE_MAP[viral.platform]

    tasks.push({
      taskId: randomUUID(),
      sourcePostId: viral.postId,
      sourcePlatform: viral.platform,
      sourceEngagement: viral.metrics,
      targetPlatforms: [...targetPlatforms],
      derivationType,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  }

  return tasks
}

/**
 * Check whether the budget allows derivative spawning.
 * Returns true if budget has remaining capacity, false if exhausted.
 */
export function canSpawnDerivatives(budgetTracker: BudgetTracker): boolean {
  const check = budgetTracker.checkBudget()
  return !check.exceeded
}

/**
 * Build a ReviewItem for a piece of derivative content.
 * Tags it as `trending-derivative` with full source attribution.
 */
export function buildDerivativeReviewItem(
  task: DerivativeTask,
  targetPlatform: PlatformName,
  content: {title?: string; body: string},
  qualityScore: number,
  runId: string,
): ReviewItem {
  const now = new Date().toISOString()
  const derivativeMetadata: DerivativeMetadata = {
    tag: 'trending-derivative',
    sourcePostId: task.sourcePostId,
    sourcePlatform: task.sourcePlatform,
    sourceEngagement: task.sourceEngagement,
    derivationType: task.derivationType,
  }

  return {
    id: randomUUID(),
    runId,
    platform: targetPlatform,
    status: 'pending',
    content: {
      title: content.title,
      body: content.body,
      platformMeta: {derivativeMetadata},
    },
    qualityScore,
    complianceFlags: [],
    contentType: 'trending-derivative',
    generatedBy: 'viral-derivative-spawner',
    generatedAt: now,
    editHistory: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Execute derivative tasks in parallel.
 * Each task calls the provided executor function and returns results.
 * Tasks share the parent pipeline run's budget tracker.
 *
 * @param tasks - DerivativeTasks to execute in parallel.
 * @param executor - Async function that processes one task and returns review items.
 * @returns Array of completed DerivativeTasks with status updates.
 */
export async function executeDerivativeTasks(
  tasks: DerivativeTask[],
  executor: (task: DerivativeTask) => Promise<ReviewItem[]>,
): Promise<{completedTasks: DerivativeTask[]; reviewItems: ReviewItem[]}> {
  const allReviewItems: ReviewItem[] = []
  const completedTasks: DerivativeTask[] = []

  const results = await Promise.all(
    tasks.map(async (task) => {
      const updated = {...task, status: 'running' as const}
      try {
        const items = await executor(updated)
        return {
          task: {...updated, status: 'completed' as const},
          items,
          error: null,
        }
      } catch (error) {
        return {
          task: {...updated, status: 'failed' as const},
          items: [] as ReviewItem[],
          error,
        }
      }
    }),
  )

  for (const result of results) {
    completedTasks.push(result.task)
    allReviewItems.push(...result.items)
  }

  return {completedTasks, reviewItems: allReviewItems}
}
