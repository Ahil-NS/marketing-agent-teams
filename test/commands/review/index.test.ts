import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

const mockList = vi.fn()
const mockWriteFile = vi.fn()

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

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
      flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: undefined, output: undefined},
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
      flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: undefined, output: undefined},
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
      flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: true, export: undefined, output: undefined},
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
      flags: {'run-id': targetRunId, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({runId: targetRunId})
  })

  it('filters by --platform flag', async () => {
    mockList.mockResolvedValue([makeItem({platform: 'reddit'})])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, platform: 'reddit', 'quality-above': undefined, type: undefined, status: undefined, json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({platform: 'reddit'})
  })

  it('filters by --quality-above flag converting 0-100 to 0-1', async () => {
    mockList.mockResolvedValue([makeItem({qualityScore: 0.92})])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, platform: undefined, 'quality-above': 85, type: undefined, status: undefined, json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({qualityAbove: 0.85})
  })

  it('filters by --type flag', async () => {
    mockList.mockResolvedValue([makeItem({contentType: 'trending-derivative'})])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: 'trending-derivative', status: undefined, json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({contentType: 'trending-derivative'})
  })

  it('filters by --status flag', async () => {
    mockList.mockResolvedValue([makeItem({status: 'approved'})])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: 'approved', json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({status: 'approved'})
  })

  it('combines multiple filter flags', async () => {
    mockList.mockResolvedValue([makeItem({platform: 'reddit', qualityScore: 0.95})])

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, platform: 'reddit', 'quality-above': 90, type: undefined, status: 'pending', json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockList).toHaveBeenCalledWith({platform: 'reddit', qualityAbove: 0.90, status: 'pending'})
  })

  it('shows filtered count when filters are active', async () => {
    const filteredItems = [makeItem({id: 'item-001', platform: 'reddit'})]
    const allItems = [
      makeItem({id: 'item-001', platform: 'reddit'}),
      makeItem({id: 'item-002', platform: 'tiktok'}),
      makeItem({id: 'item-003', platform: 'facebook'}),
    ]
    // First call returns filtered, second call returns all
    mockList.mockResolvedValueOnce(filteredItems).mockResolvedValueOnce(allItems)

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {'run-id': undefined, platform: 'reddit', 'quality-above': undefined, type: undefined, status: undefined, json: false, export: undefined, output: undefined},
      args: {},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(logOutput.some((line) => line.includes('Showing 1 of 3 items (filtered)'))).toBe(true)
  })

  describe('--export flag', () => {
    it('exports items as JSON to stdout', async () => {
      const items = [makeItem({id: 'item-001'})]
      mockList.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: 'json', output: undefined},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()

      expect(result).toEqual(items)
      // Should output JSON to stdout (via this.log)
      const jsonOutput = logOutput.join('\n')
      const parsed = JSON.parse(jsonOutput) as ReviewItem[]
      expect(parsed).toHaveLength(1)
      expect(parsed[0].id).toBe('item-001')
      // Should NOT render table
      expect(vi.mocked(ContentRenderer.renderQueueTable)).not.toHaveBeenCalled()
    })

    it('exports items as CSV to stdout', async () => {
      const items = [makeItem({id: 'item-001', platform: 'reddit', qualityScore: 0.85})]
      mockList.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: 'csv', output: undefined},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()

      expect(result).toEqual(items)
      const csvOutput = logOutput.join('\n')
      expect(csvOutput).toContain('id,platform,status,qualityScore')
      expect(csvOutput).toContain('item-001')
      expect(vi.mocked(ContentRenderer.renderQueueTable)).not.toHaveBeenCalled()
    })

    it('exports to file when --output is specified', async () => {
      const items = [makeItem({id: 'item-001'})]
      mockList.mockResolvedValue(items)
      mockWriteFile.mockResolvedValue(undefined)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: 'json', output: '/tmp/export.json'},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()

      expect(mockWriteFile).toHaveBeenCalledWith('/tmp/export.json', expect.any(String), 'utf-8')
      expect(logOutput.some((line) => line.includes('Exported 1 items to /tmp/export.json'))).toBe(true)
    })

    it('exports CSV to file when --output and --export csv are specified', async () => {
      const items = [makeItem({id: 'item-001'}), makeItem({id: 'item-002'})]
      mockList.mockResolvedValue(items)
      mockWriteFile.mockResolvedValue(undefined)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: 'csv', output: '/tmp/export.csv'},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()

      expect(mockWriteFile).toHaveBeenCalledWith('/tmp/export.csv', expect.stringContaining('id,platform,status'), 'utf-8')
      expect(logOutput.some((line) => line.includes('Exported 2 items to /tmp/export.csv'))).toBe(true)
    })

    it('combines export with platform filter', async () => {
      const tiktokItems = [makeItem({id: 'item-001', platform: 'tiktok'})]
      mockList.mockResolvedValue(tiktokItems)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: 'tiktok', 'quality-above': undefined, type: undefined, status: undefined, json: false, export: 'json', output: undefined},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()

      expect(mockList).toHaveBeenCalledWith({platform: 'tiktok'})
      expect(result).toEqual(tiktokItems)
      const jsonOutput = logOutput.join('\n')
      const parsed = JSON.parse(jsonOutput) as ReviewItem[]
      expect(parsed).toHaveLength(1)
      expect(parsed[0].platform).toBe('tiktok')
    })

    it('combines export with multiple filters', async () => {
      const items = [makeItem({id: 'item-001', platform: 'reddit', qualityScore: 0.95})]
      mockList.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: 'reddit', 'quality-above': 80, type: undefined, status: 'pending', json: false, export: 'csv', output: undefined},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()

      expect(mockList).toHaveBeenCalledWith({platform: 'reddit', qualityAbove: 0.80, status: 'pending'})
      const csvOutput = logOutput.join('\n')
      expect(csvOutput).toContain('id,platform,status,qualityScore')
      expect(csvOutput).toContain('item-001')
    })

    it('exports empty array when queue is empty', async () => {
      mockList.mockResolvedValue([])

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: 'json', output: undefined},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      const result = await cmd.run()

      expect(result).toEqual([])
      expect(logOutput.join('')).toBe('[]')
      // Should NOT show empty state message when exporting
      expect(vi.mocked(ContentRenderer.renderEmptyState)).not.toHaveBeenCalled()
    })

    it('does not write to file when only --output is specified without --export', async () => {
      const items = [makeItem({id: 'item-001'})]
      mockList.mockResolvedValue(items)

      const cmd = createCommandInstance()
      cmd.parse = vi.fn().mockResolvedValue({
        flags: {'run-id': undefined, platform: undefined, 'quality-above': undefined, type: undefined, status: undefined, json: false, export: undefined, output: '/tmp/export.json'},
        args: {},
        argv: [],
        raw: [],
        metadata: {},
        nonExistentFlags: {},
      })

      await cmd.run()

      expect(mockWriteFile).not.toHaveBeenCalled()
      expect(vi.mocked(ContentRenderer.renderQueueTable)).toHaveBeenCalled()
    })
  })
})
