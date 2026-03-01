import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

const mockApprove = vi.fn()
const mockGetById = vi.fn()

vi.mock('../../../src/lib/review-queue/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/review-queue/index.js')>()
  return {
    ...actual,
    ReviewQueue: class MockReviewQueue {
      approve = mockApprove
      getById = mockGetById
    },
  }
})

import ReviewApprove from '../../../src/commands/review/approve.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'approved',
    content: {title: 'Test', body: 'Body', platformMeta: {}},
    qualityScore: 0.85,
    complianceFlags: [],
    contentType: 'standard',
    generatedBy: 'reddit-post-creator',
    generatedAt: '2026-03-01T10:00:00Z',
    editHistory: [],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    userFeedback: {decision: 'approved', editedAt: '2026-03-01T10:00:00Z'},
    ...overrides,
  }
}

describe('mat review approve command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): ReviewApprove {
    const cmd = new ReviewApprove([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('approves item and displays confirmation', async () => {
    const approved = makeItem({id: 'item-001'})
    mockApprove.mockResolvedValue(approved)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {notes: undefined, json: false},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()
    expect(result.id).toBe('item-001')
    expect(mockApprove).toHaveBeenCalledWith('item-001', undefined)
    expect(logOutput.some((line) => line.includes('Approved item item-001'))).toBe(true)
  })

  it('passes notes flag to approve', async () => {
    const approved = makeItem({id: 'item-001'})
    mockApprove.mockResolvedValue(approved)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {notes: 'Looks good', json: false},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()
    expect(mockApprove).toHaveBeenCalledWith('item-001', 'Looks good')
  })

  it('returns item for JSON serialization', async () => {
    const approved = makeItem({id: 'item-001'})
    mockApprove.mockResolvedValue(approved)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {notes: undefined, json: true},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()
    expect(result.status).toBe('approved')
  })
})
