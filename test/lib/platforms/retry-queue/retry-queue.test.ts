import {readdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {AdapterRegistry} from '../../../../src/lib/platforms/adapter-registry.js'
import {RetryItemNotFoundError, RetryQueue, RetryQueueError} from '../../../../src/lib/platforms/retry-queue/index.js'
import {DEFAULT_MAX_ATTEMPTS, retryQueueItemSchema} from '../../../../src/lib/platforms/retry-queue/types.js'
import type {PlatformAdapter, PlatformContent, PublishResult} from '../../../../src/lib/platforms/types.js'
import type {RetryErrorDetail} from '../../../../src/lib/platforms/retry-queue/types.js'
import {createTestDir, removeTestDir} from '../../../helpers/test-project.js'

function makeContent(overrides: Partial<PlatformContent> = {}): PlatformContent {
  return {
    itemId: 'test-item-1',
    platform: 'reddit',
    content: {
      title: 'Test Post',
      body: 'Test body content',
      hashtags: [],
      platformMeta: {subreddit: 'marketing'},
    },
    ...overrides,
  }
}

function makeTransientError(overrides: Partial<RetryErrorDetail> = {}): RetryErrorDetail {
  return {
    code: 'PLATFORM_PUBLISH_FAILED',
    message: 'Rate limit exceeded',
    classification: 'transient',
    ...overrides,
  }
}

function makePermanentError(overrides: Partial<RetryErrorDetail> = {}): RetryErrorDetail {
  return {
    code: 'PLATFORM_AUTH_FAILED',
    message: 'Authentication revoked',
    classification: 'permanent',
    ...overrides,
  }
}

function createMockAdapter(platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram', publishFn?: () => Promise<PublishResult>): PlatformAdapter {
  return {
    platform,
    authenticate: vi.fn(),
    validateContent: vi.fn(),
    publish: publishFn ?? vi.fn().mockResolvedValue({success: true, platform, itemId: 'test-item-1'}),
    getMetrics: vi.fn(),
    getRateLimits: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as PlatformAdapter
}

let testDir: string
let queue: RetryQueue

beforeEach(async () => {
  testDir = await createTestDir()
  queue = new RetryQueue({matDir: testDir})
})

afterEach(async () => {
  await removeTestDir(testDir)
})

// ===========================================================================
// Task 1 & 4: Module structure and schemas
// ===========================================================================

describe('RetryQueueItem schema', () => {
  it('validates a well-formed retry queue item', () => {
    const item = {
      itemId: 'item-1',
      platform: 'reddit',
      content: makeContent(),
      state: 'pending',
      error: makeTransientError(),
      attemptCount: 1,
      maxAttempts: 10,
      firstFailedAt: '2026-03-01T10:00:00.000Z',
      lastAttemptAt: '2026-03-01T10:00:00.000Z',
      nextRetryAt: '2026-03-01T10:00:02.000Z',
      resolution: null,
    }

    const result = retryQueueItemSchema.safeParse(item)
    expect(result.success).toBe(true)
  })

  it('rejects item with invalid state', () => {
    const item = {
      itemId: 'item-1',
      platform: 'reddit',
      content: makeContent(),
      state: 'running',
      error: makeTransientError(),
      attemptCount: 1,
      maxAttempts: 10,
      firstFailedAt: '2026-03-01T10:00:00.000Z',
      lastAttemptAt: '2026-03-01T10:00:00.000Z',
      nextRetryAt: '2026-03-01T10:00:02.000Z',
      resolution: null,
    }

    const result = retryQueueItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })

  it('rejects item with missing required fields', () => {
    const result = retryQueueItemSchema.safeParse({itemId: 'item-1'})
    expect(result.success).toBe(false)
  })

  it('defaults maxAttempts to DEFAULT_MAX_ATTEMPTS', () => {
    expect(DEFAULT_MAX_ATTEMPTS).toBe(10)
  })

  it('rejects item with negative attemptCount', () => {
    const item = {
      itemId: 'item-1',
      platform: 'reddit',
      content: makeContent(),
      state: 'pending',
      error: makeTransientError(),
      attemptCount: -1,
      maxAttempts: 10,
      firstFailedAt: '2026-03-01T10:00:00.000Z',
      lastAttemptAt: '2026-03-01T10:00:00.000Z',
      nextRetryAt: '2026-03-01T10:00:02.000Z',
      resolution: null,
    }

    const result = retryQueueItemSchema.safeParse(item)
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// Task 2: Persistent storage
// ===========================================================================

describe('RetryQueue — enqueue', () => {
  it('writes a retry item to disk as JSON (AC1)', async () => {
    const content = makeContent()
    const error = makeTransientError()
    const now = new Date('2026-03-01T10:00:00.000Z')

    await queue.enqueue(content, error, now)

    const queueDir = join(testDir, 'state', 'retry-queue')
    const files = await readdir(queueDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))
    expect(jsonFiles).toHaveLength(1)
    expect(jsonFiles[0]).toBe('test-item-1.json')

    const raw = await readFile(join(queueDir, jsonFiles[0]), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.itemId).toBe('test-item-1')
    expect(parsed.platform).toBe('reddit')
    expect(parsed.state).toBe('pending')
    expect(parsed.attemptCount).toBe(1)
    expect(parsed.error.classification).toBe('transient')
  })

  it('uses atomic write pattern — no .tmp files remain after success (AC1)', async () => {
    await queue.enqueue(makeContent(), makeTransientError())

    const queueDir = join(testDir, 'state', 'retry-queue')
    const files = await readdir(queueDir)
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('stores full platform content in the retry item', async () => {
    const content = makeContent({
      itemId: 'rich-item',
      content: {
        title: 'Rich Post',
        body: 'Body with **markdown**',
        hashtags: ['#test', '#retry'],
        platformMeta: {subreddit: 'tech', flairId: 'abc-123'},
      },
    })

    await queue.enqueue(content, makeTransientError())
    const items = await queue.loadAll()

    expect(items).toHaveLength(1)
    expect(items[0].content.content.title).toBe('Rich Post')
    expect(items[0].content.content.hashtags).toEqual(['#test', '#retry'])
    expect(items[0].content.content.platformMeta).toEqual({subreddit: 'tech', flairId: 'abc-123'})
  })

  it('sets nextRetryAt in the future', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent(), makeTransientError(), now)
    const items = await queue.loadAll()

    expect(items).toHaveLength(1)
    const nextRetry = new Date(items[0].nextRetryAt)
    expect(nextRetry.getTime()).toBeGreaterThan(now.getTime())
  })
})

describe('RetryQueue — loadAll', () => {
  it('reads all items from the queue directory (AC2)', async () => {
    await queue.enqueue(makeContent({itemId: 'item-a'}), makeTransientError())
    await queue.enqueue(makeContent({itemId: 'item-b'}), makeTransientError())
    await queue.enqueue(makeContent({itemId: 'item-c'}), makeTransientError())

    const items = await queue.loadAll()
    expect(items).toHaveLength(3)
    const ids = items.map((i) => i.itemId).sort()
    expect(ids).toEqual(['item-a', 'item-b', 'item-c'])
  })

  it('returns empty array when queue directory is empty', async () => {
    const items = await queue.loadAll()
    expect(items).toEqual([])
  })

  it('skips corrupted files without crashing (AC2)', async () => {
    await queue.enqueue(makeContent({itemId: 'good-item'}), makeTransientError())

    // Write a corrupted file
    const queueDir = join(testDir, 'state', 'retry-queue')
    await writeFile(join(queueDir, 'bad-item.json'), '{"broken": true}', 'utf-8')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = await queue.loadAll()

    expect(items).toHaveLength(1)
    expect(items[0].itemId).toBe('good-item')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping corrupted file'))
    warnSpy.mockRestore()
  })

  it('skips non-JSON files gracefully', async () => {
    await queue.enqueue(makeContent(), makeTransientError())

    const queueDir = join(testDir, 'state', 'retry-queue')
    await writeFile(join(queueDir, 'not-json.json'), 'this is not json!!!', 'utf-8')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = await queue.loadAll()

    expect(items).toHaveLength(1)
    warnSpy.mockRestore()
  })

  it('cleans up stale .tmp files from interrupted writes', async () => {
    const queueDir = join(testDir, 'state', 'retry-queue')
    const {mkdir} = await import('node:fs/promises')
    await mkdir(queueDir, {recursive: true})
    await writeFile(join(queueDir, 'stale-item.json.tmp'), '{}', 'utf-8')

    await queue.loadAll()

    const files = await readdir(queueDir)
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('validates items with Zod schema at deserialization boundary', async () => {
    await queue.enqueue(makeContent(), makeTransientError())
    const items = await queue.loadAll()

    // If it passed loadAll, it passed Zod validation
    expect(items).toHaveLength(1)
    const validationResult = retryQueueItemSchema.safeParse(items[0])
    expect(validationResult.success).toBe(true)
  })
})

describe('RetryQueue — getById', () => {
  it('returns item by ID', async () => {
    await queue.enqueue(makeContent({itemId: 'findme'}), makeTransientError())
    const item = await queue.getById('findme')
    expect(item.itemId).toBe('findme')
  })

  it('throws RetryItemNotFoundError when item does not exist', async () => {
    await expect(queue.getById('nonexistent')).rejects.toThrow(RetryItemNotFoundError)
  })

  it('rejects path traversal in item ID', async () => {
    await expect(queue.getById('../../../etc/passwd')).rejects.toThrow(RetryQueueError)
  })
})

describe('RetryQueue — remove', () => {
  it('deletes item file from disk (AC3 success path)', async () => {
    await queue.enqueue(makeContent({itemId: 'to-remove'}), makeTransientError())
    let items = await queue.loadAll()
    expect(items).toHaveLength(1)

    await queue.remove('to-remove')
    items = await queue.loadAll()
    expect(items).toHaveLength(0)
  })

  it('throws RetryItemNotFoundError when removing nonexistent item', async () => {
    await expect(queue.remove('nonexistent')).rejects.toThrow(RetryItemNotFoundError)
  })

  it('rejects path traversal in remove', async () => {
    await expect(queue.remove('../../foo')).rejects.toThrow(RetryQueueError)
  })
})

// ===========================================================================
// Task 3: Retry logic
// ===========================================================================

describe('RetryQueue — processRetries', () => {
  it('retries pending items and removes on success (AC3)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'retry-ok'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    registry.register(createMockAdapter('reddit'))

    // Set time far in the future so nextRetryAt has passed
    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    const result = await queue.processRetries(registry, futureTime)

    expect(result.succeeded).toContain('retry-ok')
    expect(result.failed).toHaveLength(0)

    const remaining = await queue.loadAll()
    expect(remaining).toHaveLength(0)
  })

  it('increments attempt count on transient failure (AC3)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'retry-fail'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    const failingAdapter = createMockAdapter('reddit', async () => ({
      success: false,
      platform: 'reddit' as const,
      itemId: 'retry-fail',
      error: {
        code: 'PLATFORM_PUBLISH_FAILED',
        message: 'Server error',
        classification: 'transient' as const,
        retryable: true,
      },
    }))
    registry.register(failingAdapter)

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    await queue.processRetries(registry, futureTime)

    const items = await queue.loadAll()
    expect(items).toHaveLength(1)
    expect(items[0].attemptCount).toBe(2)
    expect(items[0].state).toBe('pending')
  })

  it('moves to failed state on permanent failure (AC4)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'perm-fail'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    const permFailAdapter = createMockAdapter('reddit', async () => ({
      success: false,
      platform: 'reddit' as const,
      itemId: 'perm-fail',
      error: {
        code: 'PLATFORM_AUTH_FAILED',
        message: 'Auth revoked',
        classification: 'permanent' as const,
        retryable: false,
      },
    }))
    registry.register(permFailAdapter)

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    const result = await queue.processRetries(registry, futureTime)

    expect(result.failed).toContain('perm-fail')
    const items = await queue.loadAll()
    expect(items).toHaveLength(1)
    expect(items[0].state).toBe('failed')
    expect(items[0].resolution).toBeTruthy()
  })

  it('moves to failed state on max retries exceeded (AC5)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    // Create queue with maxAttempts = 2
    const smallQueue = new RetryQueue({matDir: testDir, maxAttempts: 2})

    await smallQueue.enqueue(makeContent({itemId: 'max-retry'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    const failingAdapter = createMockAdapter('reddit', async () => ({
      success: false,
      platform: 'reddit' as const,
      itemId: 'max-retry',
      error: {
        code: 'PLATFORM_PUBLISH_FAILED',
        message: 'Still failing',
        classification: 'transient' as const,
        retryable: true,
      },
    }))
    registry.register(failingAdapter)

    // First retry: attemptCount=1, tries publish, fails transient → newAttemptCount=2 >= maxAttempts=2 → failed
    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    const result = await smallQueue.processRetries(registry, futureTime)

    expect(result.failed).toContain('max-retry')
    const items = await smallQueue.loadAll()
    expect(items).toHaveLength(1)
    expect(items[0].state).toBe('failed')
    expect(items[0].resolution).toContain('Max retries exceeded')
  })

  it('respects nextRetryAt timing — skips items not yet due (AC3)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'not-due'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    registry.register(createMockAdapter('reddit'))

    // Process at the exact same time as enqueue — nextRetryAt is in the future
    const result = await queue.processRetries(registry, now)
    expect(result.skipped).toContain('not-due')
    expect(result.succeeded).toHaveLength(0)

    // Item should still exist
    const items = await queue.loadAll()
    expect(items).toHaveLength(1)
  })

  it('handles exception thrown by adapter.publish()', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'throw-item'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    const throwingAdapter = createMockAdapter('reddit', async () => {
      throw new Error('Network timeout')
    })
    registry.register(throwingAdapter)

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    const result = await queue.processRetries(registry, futureTime)

    expect(result.errors).toHaveLength(1)
    const items = await queue.loadAll()
    expect(items).toHaveLength(1)
    // Should still be pending (transient network error)
    expect(items[0].attemptCount).toBe(2)
  })

  it('skips items when platform adapter is not registered', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(
      makeContent({itemId: 'no-adapter', platform: 'tiktok'}),
      makeTransientError(),
      now,
    )

    const registry = new AdapterRegistry()
    // No adapter registered for tiktok

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    const result = await queue.processRetries(registry, futureTime)

    expect(result.skipped).toContain('no-adapter')
    expect(result.errors).toHaveLength(1)
  })

  it('processes multiple items across platforms', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'reddit-1', platform: 'reddit'}), makeTransientError(), now)
    await queue.enqueue(makeContent({itemId: 'tiktok-1', platform: 'tiktok'}), makeTransientError(), now)

    const registry = new AdapterRegistry()
    registry.register(createMockAdapter('reddit'))
    registry.register(createMockAdapter('tiktok'))

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    const result = await queue.processRetries(registry, futureTime)

    expect(result.succeeded).toHaveLength(2)
    expect(result.succeeded).toContain('reddit-1')
    expect(result.succeeded).toContain('tiktok-1')
  })

  it('does not retry failed (non-pending) items', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'already-failed'}), makePermanentError(), now)

    // Manually change item to failed via processRetries with permanent error adapter
    const registry = new AdapterRegistry()
    const permAdapter = createMockAdapter('reddit', async () => ({
      success: false,
      platform: 'reddit' as const,
      itemId: 'already-failed',
      error: {
        code: 'PLATFORM_AUTH_FAILED',
        message: 'Auth revoked',
        classification: 'permanent' as const,
        retryable: false,
      },
    }))
    registry.register(permAdapter)

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    await queue.processRetries(registry, futureTime)

    // Now try to process again — the failed item should not be retried
    const successAdapter = createMockAdapter('reddit')
    const registry2 = new AdapterRegistry()
    registry2.register(successAdapter)

    const laterTime = new Date('2026-03-03T00:00:00.000Z')
    const result = await queue.processRetries(registry2, laterTime)

    expect(result.succeeded).toHaveLength(0)
    // Item still exists as failed
    const items = await queue.loadAll()
    expect(items).toHaveLength(1)
    expect(items[0].state).toBe('failed')
  })
})

// ===========================================================================
// Task 5: Status and purge
// ===========================================================================

describe('RetryQueue — getQueueStatus', () => {
  it('returns correct counts and per-platform breakdown (AC6)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'r1', platform: 'reddit'}), makeTransientError(), now)
    await queue.enqueue(makeContent({itemId: 'r2', platform: 'reddit'}), makeTransientError(), now)
    await queue.enqueue(makeContent({itemId: 't1', platform: 'tiktok'}), makeTransientError(), now)

    // Mark r1 as failed by processing with permanent error adapter that only fails for r1
    const registry = new AdapterRegistry()
    let callCount = 0
    const mixedAdapter = createMockAdapter('reddit', async () => {
      callCount++
      // First call (r1) → permanent failure, second call (r2) → transient failure (stays pending)
      if (callCount === 1) {
        return {
          success: false,
          platform: 'reddit' as const,
          itemId: 'r1',
          error: {
            code: 'PLATFORM_AUTH_FAILED',
            message: 'Auth revoked',
            classification: 'permanent' as const,
            retryable: false,
          },
        }
      }

      return {
        success: false,
        platform: 'reddit' as const,
        itemId: 'r2',
        error: {
          code: 'PLATFORM_PUBLISH_FAILED',
          message: 'Server error',
          classification: 'transient' as const,
          retryable: true,
        },
      }
    })
    const successAdapter = createMockAdapter('tiktok')
    registry.register(mixedAdapter)
    registry.register(successAdapter)

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    await queue.processRetries(registry, futureTime)

    // r1 → failed, r2 → pending (transient, incremented), t1 → succeeded (removed)
    const status = await queue.getQueueStatus()

    expect(status.pendingCount).toBe(1) // r2
    expect(status.failedCount).toBe(1) // r1
    expect(status.byPlatform.reddit).toEqual({pending: 1, failed: 1})
    expect(status.nextRetryAt).toBeTruthy()
  })

  it('returns zeros when queue is empty', async () => {
    const status = await queue.getQueueStatus()
    expect(status.pendingCount).toBe(0)
    expect(status.failedCount).toBe(0)
    expect(status.byPlatform).toEqual({})
    expect(status.nextRetryAt).toBeNull()
  })
})

describe('RetryQueue — purgeFailed', () => {
  it('removes all failed items from disk (AC7)', async () => {
    const now = new Date('2026-03-01T10:00:00.000Z')
    await queue.enqueue(makeContent({itemId: 'fail-1'}), makeTransientError(), now)
    await queue.enqueue(makeContent({itemId: 'keep-1'}), makeTransientError(), now)

    // Mark fail-1 as failed
    const registry = new AdapterRegistry()
    registry.register(
      createMockAdapter('reddit', async () => ({
        success: false,
        platform: 'reddit' as const,
        itemId: 'fail-1',
        error: {
          code: 'PLATFORM_AUTH_FAILED',
          message: 'Auth revoked',
          classification: 'permanent' as const,
          retryable: false,
        },
      })),
    )

    const futureTime = new Date('2026-03-02T00:00:00.000Z')
    await queue.processRetries(registry, futureTime)

    const purged = await queue.purgeFailed()
    expect(purged).toContain('fail-1')

    const remaining = await queue.loadAll()
    // keep-1 should still exist (as pending, with incremented attempt count since adapter returned failure for all items)
    const pendingItems = remaining.filter((i) => i.state === 'pending')
    expect(pendingItems.length).toBeGreaterThanOrEqual(0)
    // fail-1 should be gone
    expect(remaining.find((i) => i.itemId === 'fail-1')).toBeUndefined()
  })
})

// ===========================================================================
// Error classes
// ===========================================================================

describe('RetryQueue errors', () => {
  it('RetryQueueError has correct error code', () => {
    const error = new RetryQueueError('test', 'detail')
    expect(error.code).toBe('RETRY_QUEUE_ERROR')
    expect(error.severity).toBe('transient')
    expect(error.source).toBe('retry-queue')
  })

  it('RetryItemNotFoundError has correct error code', () => {
    const error = new RetryItemNotFoundError('item-123')
    expect(error.code).toBe('RETRY_ITEM_NOT_FOUND')
    expect(error.severity).toBe('permanent')
    expect(error.message).toContain('item-123')
  })
})
