import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

const mockReject = vi.fn()

vi.mock('../../../src/lib/review-queue/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/review-queue/index.js')>()
  return {
    ...actual,
    ReviewQueue: class MockReviewQueue {
      reject = mockReject
    },
  }
})

import ReviewReject from '../../../src/commands/review/reject.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'rejected',
    content: {title: 'Test', body: 'Body', platformMeta: {}},
    qualityScore: 0.85,
    complianceFlags: [],
    contentType: 'standard',
    generatedBy: 'reddit-post-creator',
    generatedAt: '2026-03-01T10:00:00Z',
    editHistory: [],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    userFeedback: {decision: 'rejected', reason: 'Off-brand', editedAt: '2026-03-01T10:00:00Z'},
    ...overrides,
  }
}

describe('mat review reject command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): ReviewReject {
    const cmd = new ReviewReject([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('rejects item with reason and displays confirmation', async () => {
    const rejected = makeItem({id: 'item-001'})
    mockReject.mockResolvedValue(rejected)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {reason: 'Off-brand tone', feedback: undefined, json: false},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()
    expect(result.id).toBe('item-001')
    expect(mockReject).toHaveBeenCalledWith('item-001', 'Off-brand tone', undefined)
    expect(logOutput.some((line) => line.includes('Rejected item item-001'))).toBe(true)
  })

  it('passes feedback flag to reject', async () => {
    const rejected = makeItem({id: 'item-001'})
    mockReject.mockResolvedValue(rejected)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {reason: 'Inaccurate', feedback: 'Double-check dates', json: false},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()
    expect(mockReject).toHaveBeenCalledWith('item-001', 'Inaccurate', 'Double-check dates')
  })

  it('returns item for JSON serialization', async () => {
    const rejected = makeItem({id: 'item-001'})
    mockReject.mockResolvedValue(rejected)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {reason: 'Off-brand', feedback: undefined, json: true},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()
    expect(result.status).toBe('rejected')
  })
})
