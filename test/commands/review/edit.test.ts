import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

const mockEdit = vi.fn()
const mockGetById = vi.fn()

vi.mock('../../../src/lib/review-queue/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/review-queue/index.js')>()
  return {
    ...actual,
    ReviewQueue: class MockReviewQueue {
      edit = mockEdit
      getById = mockGetById
    },
  }
})

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}))

import {input} from '@inquirer/prompts'
import ReviewEdit from '../../../src/commands/review/edit.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {title: 'Test title', body: 'Test body', platformMeta: {}},
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

describe('mat review edit command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): ReviewEdit {
    const cmd = new ReviewEdit([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('edits item and displays confirmation', async () => {
    const current = makeItem({id: 'item-001'})
    mockGetById.mockResolvedValue(current)

    const edited = makeItem({
      id: 'item-001',
      status: 'approved',
      content: {title: 'New title', body: 'Test body', platformMeta: {}},
      editHistory: [{timestamp: '2026-03-01T10:00:00Z', field: 'title', originalValue: 'Test title', newValue: 'New title'}],
    })
    mockEdit.mockResolvedValue(edited)

    // Simulate user changing title but keeping body
    vi.mocked(input)
      .mockResolvedValueOnce('New title')  // title prompt
      .mockResolvedValueOnce('Test body')  // body prompt (unchanged)

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
    expect(result.status).toBe('approved')
    expect(mockEdit).toHaveBeenCalledWith('item-001', {title: 'New title'}, undefined)
    expect(logOutput.some((line) => line.includes('Edited and approved item item-001'))).toBe(true)
  })

  it('returns current item when no changes made', async () => {
    const current = makeItem({id: 'item-001'})
    mockGetById.mockResolvedValue(current)

    // User keeps all defaults
    vi.mocked(input)
      .mockResolvedValueOnce('Test title')  // unchanged title
      .mockResolvedValueOnce('Test body')   // unchanged body

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
    expect(result).toBe(current)
    expect(mockEdit).not.toHaveBeenCalled()
    expect(logOutput.some((line) => line.includes('No changes made'))).toBe(true)
  })

  it('passes notes flag to edit', async () => {
    const current = makeItem({id: 'item-001'})
    mockGetById.mockResolvedValue(current)
    mockEdit.mockResolvedValue(makeItem({id: 'item-001', status: 'approved'}))

    vi.mocked(input)
      .mockResolvedValueOnce('Test title')
      .mockResolvedValueOnce('New body')  // changed body

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {notes: 'Fixed typo', json: false},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()
    expect(mockEdit).toHaveBeenCalledWith('item-001', {body: 'New body'}, 'Fixed typo')
  })

  it('handles items with CTA field', async () => {
    const current = makeItem({
      id: 'item-001',
      content: {title: 'Title', body: 'Body', cta: 'Click here', platformMeta: {}},
    })
    mockGetById.mockResolvedValue(current)
    mockEdit.mockResolvedValue(makeItem({id: 'item-001', status: 'approved'}))

    vi.mocked(input)
      .mockResolvedValueOnce('Title')       // unchanged title
      .mockResolvedValueOnce('Body')        // unchanged body
      .mockResolvedValueOnce('Learn more')  // changed CTA

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {notes: undefined, json: false},
      args: {id: 'item-001'},
      argv: ['item-001'],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()
    expect(mockEdit).toHaveBeenCalledWith('item-001', {cta: 'Learn more'}, undefined)
  })
})
