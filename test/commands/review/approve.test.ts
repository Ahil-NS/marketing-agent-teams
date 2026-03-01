import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

const mockApprove = vi.fn()
const mockGetById = vi.fn()
const mockList = vi.fn()
const mockBulkApprove = vi.fn()

vi.mock('../../../src/lib/review-queue/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/review-queue/index.js')>()
  return {
    ...actual,
    ReviewQueue: class MockReviewQueue {
      approve = mockApprove
      getById = mockGetById
      list = mockList
      bulkApprove = mockBulkApprove
    },
  }
})

// Mock @inquirer/prompts for bulk confirm
const mockConfirm = vi.fn()
vi.mock('@inquirer/prompts', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}))

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

  describe('single item mode', () => {
    it('approves item and displays confirmation', async () => {
      const approved = makeItem({id: 'item-001'})
      mockApprove.mockResolvedValue(approved)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: undefined, 'quality-above': undefined, type: undefined, yes: false, json: false},
        args: {id: 'item-001'},
        argv: ['item-001'],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()
      expect(result).toEqual(approved)
      expect(mockApprove).toHaveBeenCalledWith('item-001', undefined)
      expect(logOutput.some((line) => line.includes('Approved item item-001'))).toBe(true)
    })

    it('passes notes flag to approve', async () => {
      const approved = makeItem({id: 'item-001'})
      mockApprove.mockResolvedValue(approved)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: 'Looks good', platform: undefined, 'quality-above': undefined, type: undefined, yes: false, json: false},
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
        flags: {notes: undefined, platform: undefined, 'quality-above': undefined, type: undefined, yes: false, json: true},
        args: {id: 'item-001'},
        argv: ['item-001'],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()
      expect((result as ReviewItem).status).toBe('approved')
    })
  })

  describe('bulk mode', () => {
    it('bulk approves items matching platform filter with --yes', async () => {
      const items = [makeItem({id: 'item-001'}), makeItem({id: 'item-002'})]
      mockList.mockResolvedValue(items)
      mockBulkApprove.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: 'reddit', 'quality-above': undefined, type: undefined, yes: true, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()
      expect(result).toHaveLength(2)
      expect(mockBulkApprove).toHaveBeenCalledWith({platform: 'reddit'})
      expect(logOutput.some((line) => line.includes('Approved 2 items matching filter'))).toBe(true)
    })

    it('converts quality-above from 0-100 to 0-1 in bulk mode', async () => {
      const items = [makeItem({id: 'item-001', qualityScore: 0.95})]
      mockList.mockResolvedValue(items)
      mockBulkApprove.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: undefined, 'quality-above': 90, type: undefined, yes: true, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()
      expect(mockBulkApprove).toHaveBeenCalledWith({qualityAbove: 0.90})
    })

    it('prompts for confirmation in bulk mode without --yes', async () => {
      const items = [makeItem({id: 'item-001'})]
      mockList.mockResolvedValue(items)
      mockBulkApprove.mockResolvedValue(items)
      mockConfirm.mockResolvedValue(true)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: 'reddit', 'quality-above': undefined, type: undefined, yes: false, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()
      expect(mockConfirm).toHaveBeenCalledWith({message: 'Approve 1 items?'})
      expect(mockBulkApprove).toHaveBeenCalled()
    })

    it('cancels bulk approve when user declines confirmation', async () => {
      const items = [makeItem({id: 'item-001'})]
      mockList.mockResolvedValue(items)
      mockConfirm.mockResolvedValue(false)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: 'reddit', 'quality-above': undefined, type: undefined, yes: false, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()
      expect(result).toEqual([])
      expect(mockBulkApprove).not.toHaveBeenCalled()
      expect(logOutput.some((line) => line.includes('Bulk approve cancelled'))).toBe(true)
    })

    it('shows no pending items message when filter matches nothing', async () => {
      mockList.mockResolvedValue([])

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: 'instagram', 'quality-above': undefined, type: undefined, yes: true, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()
      expect(result).toEqual([])
      expect(logOutput.some((line) => line.includes('No pending items match the filter'))).toBe(true)
    })

    it('errors when no id and no filter flags provided', async () => {
      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: undefined, 'quality-above': undefined, type: undefined, yes: false, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      // cmd.error throws
      cmd.error = vi.fn().mockImplementation((msg: string) => {
        throw new Error(msg)
      }) as any

      await expect(cmd.run()).rejects.toThrow('Provide an item ID or at least one filter flag')
    })

    it('uses --type filter in bulk mode', async () => {
      const items = [makeItem({id: 'item-001', contentType: 'trending-derivative'})]
      mockList.mockResolvedValue(items)
      mockBulkApprove.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: undefined, 'quality-above': undefined, type: 'trending-derivative', yes: true, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()
      expect(mockBulkApprove).toHaveBeenCalledWith({contentType: 'trending-derivative'})
    })

    it('combines multiple filters in bulk mode', async () => {
      const items = [makeItem({id: 'item-001'})]
      mockList.mockResolvedValue(items)
      mockBulkApprove.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {notes: undefined, platform: 'reddit', 'quality-above': 90, type: 'standard', yes: true, json: false},
        args: {id: undefined},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()
      expect(mockBulkApprove).toHaveBeenCalledWith({platform: 'reddit', qualityAbove: 0.90, contentType: 'standard'})
    })
  })
})
