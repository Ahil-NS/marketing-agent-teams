import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/types.js'

const mockGetById = vi.fn()

vi.mock('../../../src/lib/review-queue/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/review-queue/index.js')>()
  return {
    ...actual,
    ReviewQueue: class MockReviewQueue {
      getById = mockGetById
    },
  }
})

vi.mock('../../../src/lib/review-queue/platform-previews.js', () => ({
  renderPlatformPreview: vi.fn().mockReturnValue('<<MOCK PREVIEW>>'),
}))

import {renderPlatformPreview} from '../../../src/lib/review-queue/platform-previews.js'
import ReviewShow from '../../../src/commands/review/show.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-2026-03-01-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {
      title: 'Test post',
      body: 'Test body content.',
      platformMeta: {subreddit: 'r/test'},
    },
    qualityScore: 0.85,
    complianceFlags: [],
    contentType: 'standard',
    generatedBy: 'reddit-post-creator',
    generatedAt: '2026-03-01T10:00:00Z',
    scheduledTime: '2026-03-02T14:00:00Z',
    editHistory: [],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

describe('mat review show <id> command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): ReviewShow {
    const cmd = new ReviewShow([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('displays platform-specific preview for an item', async () => {
    const item = makeItem()
    mockGetById.mockResolvedValue(item)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'item-2026-03-01-001'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(mockGetById).toHaveBeenCalledWith('item-2026-03-01-001')
    expect(vi.mocked(renderPlatformPreview)).toHaveBeenCalledWith(item)
    expect(result).toEqual(item)
    expect(logOutput.some((line) => line.includes('<<MOCK PREVIEW>>'))).toBe(true)
  })

  it('displays metadata: quality score, compliance flags, content type, scheduled time', async () => {
    const item = makeItem({
      qualityScore: 0.92,
      complianceFlags: ['claim-unverified', 'competitor-mention'],
      contentType: 'trending-derivative',
      scheduledTime: '2026-03-02T14:00:00Z',
    })
    mockGetById.mockResolvedValue(item)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'item-2026-03-01-001'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    const output = logOutput.join('\n')
    expect(output).toContain('0.92')
    expect(output).toContain('claim-unverified')
    expect(output).toContain('competitor-mention')
    expect(output).toContain('trending-derivative')
    expect(output).toContain('2026-03-02T14:00:00Z')
  })

  it('displays item ID, platform, status, and generated-by', async () => {
    const item = makeItem()
    mockGetById.mockResolvedValue(item)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'item-2026-03-01-001'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    const output = logOutput.join('\n')
    expect(output).toContain('item-2026-03-01-001')
    expect(output).toContain('reddit')
    expect(output).toContain('pending')
    expect(output).toContain('reddit-post-creator')
  })

  it('handles items without scheduled time', async () => {
    const item = makeItem({scheduledTime: undefined})
    mockGetById.mockResolvedValue(item)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'item-2026-03-01-001'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()
    expect(result).toEqual(item)
    // Should not crash
  })

  it('handles items with empty compliance flags', async () => {
    const item = makeItem({complianceFlags: []})
    mockGetById.mockResolvedValue(item)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'item-2026-03-01-001'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    const output = logOutput.join('\n')
    expect(output).toContain('None')
  })

  it('returns ReviewItem for JSON output', async () => {
    const item = makeItem()
    mockGetById.mockResolvedValue(item)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'item-2026-03-01-001'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()
    expect(result).toEqual(item)
  })

  it('propagates ReviewItemNotFoundError', async () => {
    const {ReviewItemNotFoundError} = await import('../../../src/lib/review-queue/errors.js')
    mockGetById.mockRejectedValue(new ReviewItemNotFoundError('nonexistent-id'))

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {json: false},
      args: {id: 'nonexistent-id'},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await expect(cmd.run()).rejects.toThrow('nonexistent-id')
  })
})
