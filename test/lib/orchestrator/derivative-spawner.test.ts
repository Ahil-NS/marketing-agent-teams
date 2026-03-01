import {describe, expect, it} from 'vitest'

import {BudgetTracker} from '../../../src/lib/orchestrator/budget-tracker.js'
import {
  buildDerivativeReviewItem,
  buildDerivativeTasks,
  canSpawnDerivatives,
  executeDerivativeTasks,
} from '../../../src/lib/orchestrator/derivative-spawner.js'
import type {DerivativeTask, ViralDetectionResult} from '../../../src/lib/orchestrator/viral-types.js'
import type {PlatformMetrics} from '../../../src/lib/platforms/types.js'
import type {ReviewItem} from '../../../src/lib/review-queue/types.js'

function makeViralResult(overrides: Partial<ViralDetectionResult> = {}): ViralDetectionResult {
  const metrics: PlatformMetrics = {
    postId: 'post-1',
    platform: 'reddit',
    views: 1000,
    likes: 600,
    comments: 150,
    shares: 50,
    engagementRate: 0.08,
    retrievedAt: '2026-03-01T00:00:00Z',
  }
  return {
    postId: 'post-1',
    platform: 'reddit',
    metrics,
    exceededThresholds: ['likes: 600 > 500'],
    detectedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildDerivativeTasks', () => {
  it('creates one task per viral detection result', () => {
    const viral = [makeViralResult()]
    const tasks = buildDerivativeTasks(viral)
    expect(tasks).toHaveLength(1)
  })

  it('creates correct derivative task from viral detection (AC3)', () => {
    const viral = [makeViralResult()]
    const tasks = buildDerivativeTasks(viral)
    const task = tasks[0]
    expect(task.sourcePostId).toBe('post-1')
    expect(task.sourcePlatform).toBe('reddit')
    expect(task.sourceEngagement).toEqual(viral[0].metrics)
    expect(task.status).toBe('pending')
    expect(task.taskId).toBeDefined()
    expect(task.createdAt).toBeDefined()
  })

  it('targets platforms OTHER than the original', () => {
    const viral = [makeViralResult({platform: 'reddit'})]
    const tasks = buildDerivativeTasks(viral)
    expect(tasks[0].targetPlatforms).not.toContain('reddit')
    expect(tasks[0].targetPlatforms).toContain('tiktok')
    expect(tasks[0].targetPlatforms).toContain('facebook')
    expect(tasks[0].targetPlatforms).toContain('instagram')
  })

  it('assigns thread-expansion derivationType for reddit', () => {
    const viral = [makeViralResult({platform: 'reddit'})]
    const tasks = buildDerivativeTasks(viral)
    expect(tasks[0].derivationType).toBe('thread-expansion')
  })

  it('assigns variation derivationType for tiktok', () => {
    const metrics: PlatformMetrics = {
      postId: 'tt-1', platform: 'tiktok', views: 15000,
      retrievedAt: '2026-03-01T00:00:00Z',
    }
    const viral = [makeViralResult({postId: 'tt-1', platform: 'tiktok', metrics})]
    const tasks = buildDerivativeTasks(viral)
    expect(tasks[0].derivationType).toBe('variation')
  })

  it('assigns repurpose derivationType for facebook', () => {
    const metrics: PlatformMetrics = {
      postId: 'fb-1', platform: 'facebook', shares: 150,
      retrievedAt: '2026-03-01T00:00:00Z',
    }
    const viral = [makeViralResult({postId: 'fb-1', platform: 'facebook', metrics})]
    const tasks = buildDerivativeTasks(viral)
    expect(tasks[0].derivationType).toBe('repurpose')
  })

  it('handles multiple viral detections', () => {
    const viral = [
      makeViralResult({postId: 'post-1', platform: 'reddit'}),
      makeViralResult({postId: 'post-2', platform: 'tiktok'}),
    ]
    const tasks = buildDerivativeTasks(viral)
    expect(tasks).toHaveLength(2)
    expect(tasks[0].sourcePostId).toBe('post-1')
    expect(tasks[1].sourcePostId).toBe('post-2')
  })

  it('returns empty array for empty viral results', () => {
    const tasks = buildDerivativeTasks([])
    expect(tasks).toHaveLength(0)
  })
})

describe('canSpawnDerivatives', () => {
  it('returns true when budget has remaining capacity (AC5)', () => {
    const tracker = new BudgetTracker({perRunLimit: 10})
    expect(canSpawnDerivatives(tracker)).toBe(true)
  })

  it('returns false when budget is exhausted (AC5)', () => {
    const tracker = new BudgetTracker({perRunLimit: 1})
    tracker.recordCost('agent-a', 1.5)
    expect(canSpawnDerivatives(tracker)).toBe(false)
  })

  it('returns true when no budget limits are configured', () => {
    const tracker = new BudgetTracker({})
    expect(canSpawnDerivatives(tracker)).toBe(true)
  })
})

describe('buildDerivativeReviewItem', () => {
  it('creates review item with trending-derivative tag (AC4)', () => {
    const task: DerivativeTask = {
      taskId: 'task-1',
      sourcePostId: 'post-1',
      sourcePlatform: 'reddit',
      sourceEngagement: {
        postId: 'post-1', platform: 'reddit', likes: 600,
        retrievedAt: '2026-03-01T00:00:00Z',
      },
      targetPlatforms: ['tiktok', 'facebook', 'instagram'],
      derivationType: 'thread-expansion',
      status: 'completed',
      createdAt: '2026-03-01T00:00:00Z',
    }

    const item = buildDerivativeReviewItem(
      task,
      'tiktok',
      {title: 'Derivative Title', body: 'Derivative body content'},
      85,
      'run-1',
    )

    expect(item.contentType).toBe('trending-derivative')
    expect(item.platform).toBe('tiktok')
    expect(item.content.body).toBe('Derivative body content')
    expect(item.qualityScore).toBe(85)
    expect(item.runId).toBe('run-1')
    expect(item.status).toBe('pending')
    expect(item.generatedBy).toBe('viral-derivative-spawner')
    expect(item.id).toBeDefined()

    // Check derivativeMetadata in platformMeta
    const meta = item.content.platformMeta.derivativeMetadata as {
      tag: string
      sourcePostId: string
      sourcePlatform: string
      derivationType: string
    }
    expect(meta.tag).toBe('trending-derivative')
    expect(meta.sourcePostId).toBe('post-1')
    expect(meta.sourcePlatform).toBe('reddit')
    expect(meta.derivationType).toBe('thread-expansion')
  })
})

describe('executeDerivativeTasks', () => {
  it('runs tasks in parallel via Promise.all (AC5)', async () => {
    const executionOrder: string[] = []

    const tasks: DerivativeTask[] = [
      {
        taskId: 'task-1', sourcePostId: 'post-1', sourcePlatform: 'reddit',
        sourceEngagement: {postId: 'post-1', platform: 'reddit', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['tiktok'], derivationType: 'thread-expansion',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
      {
        taskId: 'task-2', sourcePostId: 'post-2', sourcePlatform: 'tiktok',
        sourceEngagement: {postId: 'post-2', platform: 'tiktok', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['reddit'], derivationType: 'variation',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
    ]

    const executor = async (task: DerivativeTask): Promise<ReviewItem[]> => {
      executionOrder.push(task.taskId)
      return []
    }

    const {completedTasks} = await executeDerivativeTasks(tasks, executor)
    expect(completedTasks).toHaveLength(2)
    // Both should have been called
    expect(executionOrder).toContain('task-1')
    expect(executionOrder).toContain('task-2')
  })

  it('marks successful tasks as completed', async () => {
    const tasks: DerivativeTask[] = [
      {
        taskId: 'task-1', sourcePostId: 'post-1', sourcePlatform: 'reddit',
        sourceEngagement: {postId: 'post-1', platform: 'reddit', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['tiktok'], derivationType: 'thread-expansion',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
    ]

    const executor = async (): Promise<ReviewItem[]> => []
    const {completedTasks} = await executeDerivativeTasks(tasks, executor)
    expect(completedTasks[0].status).toBe('completed')
  })

  it('marks failed tasks as failed', async () => {
    const tasks: DerivativeTask[] = [
      {
        taskId: 'task-fail', sourcePostId: 'post-1', sourcePlatform: 'reddit',
        sourceEngagement: {postId: 'post-1', platform: 'reddit', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['tiktok'], derivationType: 'thread-expansion',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
    ]

    const executor = async (): Promise<ReviewItem[]> => {
      throw new Error('Agent execution failed')
    }

    const {completedTasks} = await executeDerivativeTasks(tasks, executor)
    expect(completedTasks[0].status).toBe('failed')
  })

  it('collects review items from all successful tasks', async () => {
    const tasks: DerivativeTask[] = [
      {
        taskId: 'task-1', sourcePostId: 'post-1', sourcePlatform: 'reddit',
        sourceEngagement: {postId: 'post-1', platform: 'reddit', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['tiktok'], derivationType: 'thread-expansion',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
      {
        taskId: 'task-2', sourcePostId: 'post-2', sourcePlatform: 'tiktok',
        sourceEngagement: {postId: 'post-2', platform: 'tiktok', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['reddit'], derivationType: 'variation',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
    ]

    const executor = async (task: DerivativeTask): Promise<ReviewItem[]> => {
      return [{
        id: `review-${task.taskId}`,
        runId: 'run-1',
        platform: task.targetPlatforms[0],
        status: 'pending',
        content: {body: 'derivative content', platformMeta: {}},
        qualityScore: 80,
        complianceFlags: [],
        contentType: 'trending-derivative',
        generatedBy: 'viral-derivative-spawner',
        generatedAt: new Date().toISOString(),
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
    }

    const {reviewItems} = await executeDerivativeTasks(tasks, executor)
    expect(reviewItems).toHaveLength(2)
  })

  it('handles empty task list', async () => {
    const executor = async (): Promise<ReviewItem[]> => []
    const {completedTasks, reviewItems} = await executeDerivativeTasks([], executor)
    expect(completedTasks).toHaveLength(0)
    expect(reviewItems).toHaveLength(0)
  })

  it('mixed success and failure: collects only successful review items', async () => {
    const tasks: DerivativeTask[] = [
      {
        taskId: 'task-ok', sourcePostId: 'post-1', sourcePlatform: 'reddit',
        sourceEngagement: {postId: 'post-1', platform: 'reddit', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['tiktok'], derivationType: 'thread-expansion',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
      {
        taskId: 'task-fail', sourcePostId: 'post-2', sourcePlatform: 'tiktok',
        sourceEngagement: {postId: 'post-2', platform: 'tiktok', retrievedAt: '2026-03-01T00:00:00Z'},
        targetPlatforms: ['reddit'], derivationType: 'variation',
        status: 'pending', createdAt: '2026-03-01T00:00:00Z',
      },
    ]

    const executor = async (task: DerivativeTask): Promise<ReviewItem[]> => {
      if (task.taskId === 'task-fail') throw new Error('fail')
      return [{
        id: `review-${task.taskId}`,
        runId: 'run-1',
        platform: task.targetPlatforms[0],
        status: 'pending',
        content: {body: 'ok content', platformMeta: {}},
        qualityScore: 90,
        complianceFlags: [],
        contentType: 'trending-derivative',
        generatedBy: 'viral-derivative-spawner',
        generatedAt: new Date().toISOString(),
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
    }

    const {completedTasks, reviewItems} = await executeDerivativeTasks(tasks, executor)
    expect(completedTasks).toHaveLength(2)
    expect(completedTasks.find((t) => t.taskId === 'task-ok')?.status).toBe('completed')
    expect(completedTasks.find((t) => t.taskId === 'task-fail')?.status).toBe('failed')
    expect(reviewItems).toHaveLength(1)
    expect(reviewItems[0].id).toBe('review-task-ok')
  })
})
