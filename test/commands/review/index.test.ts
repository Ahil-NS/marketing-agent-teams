import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

const mockList = vi.fn()

// Mock the ReviewQueue class with a proper constructor
vi.mock('../../../src/lib/review-queue/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/review-queue/index.js')>()
  return {
    ...actual,
    ReviewQueue: class MockReviewQueue {
      list = mockList
    },
  }
})

// Mock content-renderer separately to avoid real formatting dependencies
vi.mock('../../../src/lib/review-queue/content-renderer.js', () => ({
  ContentRenderer: {
    renderQueueTable: vi.fn(),
    renderEmptyState: vi.fn(),
  },
}))

import {ContentRenderer} from '../../../src/lib/review-queue/content-renderer.js'
import Review from '../../../src/commands/review/index.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-2026-03-01-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {
      title: 'Test post',
      body: 'Test body content.',
      platformMeta: {},
    },
    qualityScore: 0.85,
    complianceFlags: [],
    contentType: 'standard',
    generatedBy: 'reddit-post-creator',
    generatedAt: '2026-03-01T10:00:00Z',
    editHistory: [],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

describe('mat review command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): Review {
    const cmd = new Review([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('lists items when queue has content', async () => {
    const items = [
      makeItem({id: 'item-001', platform: 'reddit'}),
      makeItem({id: 'item-002', platform: 'tiktok'}),
    ]

    mockList.mockResolvedValue(items)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toEqual(items)
    expect(vi.mocked(ContentRenderer.renderQueueTable)).toHaveBeenCalled()
  })

  it('displays empty state message when queue is empty', async () => {
    mockList.mockResolvedValue([])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toEqual([])
    expect(vi.mocked(ContentRenderer.renderEmptyState)).toHaveBeenCalled()
  })

  it('returns items for JSON serialization', async () => {
    const items = [makeItem({id: 'item-001'})]
    mockList.mockResolvedValue(items)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, json: true},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toEqual(items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-001')
  })

  it('filters by --run-id flag', async () => {
    const targetRunId = '550e8400-e29b-41d4-a716-446655440000'
    mockList.mockResolvedValue([makeItem({runId: targetRunId})])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': targetRunId, json: false},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({runId: targetRunId})
  })
})
