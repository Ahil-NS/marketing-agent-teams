import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {ReviewQueue, ReviewItemNotFoundError, InvalidStatusTransitionError} from '../../../src/lib/review-queue/index.js'
import type {ReviewItem} from '../../../src/lib/review-queue/index.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-2026-03-01-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {
      title: 'Test post',
      body: 'Test body content for the review item.',
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

describe('ReviewQueue', () => {
  let projectRoot: string
  let queueDir: string
  let queue: ReviewQueue

  beforeEach(async () => {
    projectRoot = join(tmpdir(), `mat-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    queueDir = join(projectRoot, '.mat', 'state', 'review-queue')
    queue = new ReviewQueue(projectRoot)
  })

  afterEach(async () => {
    await rm(projectRoot, {recursive: true, force: true})
  })

  describe('list()', () => {
    it('returns all items from queue directory', async () => {
      await mkdir(queueDir, {recursive: true})
      const item1 = makeItem({id: 'item-001'})
      const item2 = makeItem({id: 'item-002', platform: 'tiktok'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item1))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(item2))

      const items = await queue.list()
      expect(items).toHaveLength(2)
    })

    it('returns empty array when directory does not exist', async () => {
      const items = await queue.list()
      expect(items).toEqual([])
    })

    it('returns empty array when directory is empty', async () => {
      await mkdir(queueDir, {recursive: true})
      const items = await queue.list()
      expect(items).toEqual([])
    })

    it('filters by platform', async () => {
      await mkdir(queueDir, {recursive: true})
      const reddit = makeItem({id: 'item-001', platform: 'reddit'})
      const tiktok = makeItem({id: 'item-002', platform: 'tiktok'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(reddit))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(tiktok))

      const items = await queue.list({platform: 'reddit'})
      expect(items).toHaveLength(1)
      expect(items[0].platform).toBe('reddit')
    })

    it('filters by status', async () => {
      await mkdir(queueDir, {recursive: true})
      const pending = makeItem({id: 'item-001', status: 'pending'})
      const approved = makeItem({id: 'item-002', status: 'approved'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(pending))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(approved))

      const items = await queue.list({status: 'pending'})
      expect(items).toHaveLength(1)
      expect(items[0].status).toBe('pending')
    })

    it('filters by contentType', async () => {
      await mkdir(queueDir, {recursive: true})
      const standard = makeItem({id: 'item-001', contentType: 'standard'})
      const flagged = makeItem({id: 'item-002', contentType: 'compliance-flagged'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(standard))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(flagged))

      const items = await queue.list({contentType: 'compliance-flagged'})
      expect(items).toHaveLength(1)
      expect(items[0].contentType).toBe('compliance-flagged')
    })

    it('filters by runId', async () => {
      await mkdir(queueDir, {recursive: true})
      const run1 = makeItem({id: 'item-001', runId: '550e8400-e29b-41d4-a716-446655440000'})
      const run2 = makeItem({id: 'item-002', runId: 'a50e8400-e29b-41d4-a716-446655440999'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(run1))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(run2))

      const items = await queue.list({runId: '550e8400-e29b-41d4-a716-446655440000'})
      expect(items).toHaveLength(1)
      expect(items[0].runId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('sorts by platform then by status', async () => {
      await mkdir(queueDir, {recursive: true})
      const tiktokPending = makeItem({id: 'item-001', platform: 'tiktok', status: 'pending'})
      const redditApproved = makeItem({id: 'item-002', platform: 'reddit', status: 'approved'})
      const redditPending = makeItem({id: 'item-003', platform: 'reddit', status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(tiktokPending))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(redditApproved))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(redditPending))

      const items = await queue.list()
      expect(items).toHaveLength(3)
      // reddit items first (alphabetically), pending before approved
      expect(items[0].id).toBe('item-003') // reddit, pending
      expect(items[1].id).toBe('item-002') // reddit, approved
      expect(items[2].id).toBe('item-001') // tiktok, pending
    })

    it('skips invalid JSON files with warning', async () => {
      await mkdir(queueDir, {recursive: true})
      const valid = makeItem({id: 'item-001'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(valid))
      await writeFile(join(queueDir, 'bad.json'), 'not valid json{{{')

      const items = await queue.list()
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('item-001')
    })

    it('skips files that fail schema validation', async () => {
      await mkdir(queueDir, {recursive: true})
      const valid = makeItem({id: 'item-001'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(valid))
      await writeFile(join(queueDir, 'invalid.json'), JSON.stringify({id: 'no-other-fields'}))

      const items = await queue.list()
      expect(items).toHaveLength(1)
    })

    it('ignores .tmp files', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))
      await writeFile(join(queueDir, 'item-002.json.tmp'), JSON.stringify(makeItem({id: 'item-002'})))

      const items = await queue.list()
      expect(items).toHaveLength(1)
    })

    it('filters by qualityAbove', async () => {
      await mkdir(queueDir, {recursive: true})
      const high = makeItem({id: 'item-001', qualityScore: 0.92})
      const low = makeItem({id: 'item-002', qualityScore: 0.70})
      const borderline = makeItem({id: 'item-003', qualityScore: 0.85})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(high))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(low))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(borderline))

      const items = await queue.list({qualityAbove: 0.85})
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('item-001')
    })

    it('qualityAbove=0 returns all items', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', qualityScore: 0.1})))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(makeItem({id: 'item-002', qualityScore: 0.99})))

      const items = await queue.list({qualityAbove: 0})
      expect(items).toHaveLength(2)
    })

    it('combines multiple filters with AND logic', async () => {
      await mkdir(queueDir, {recursive: true})
      const match = makeItem({id: 'item-001', platform: 'reddit', qualityScore: 0.92, contentType: 'standard', status: 'pending'})
      const wrongPlatform = makeItem({id: 'item-002', platform: 'tiktok', qualityScore: 0.95, contentType: 'standard', status: 'pending'})
      const lowScore = makeItem({id: 'item-003', platform: 'reddit', qualityScore: 0.50, contentType: 'standard', status: 'pending'})
      const wrongType = makeItem({id: 'item-004', platform: 'reddit', qualityScore: 0.95, contentType: 'compliance-flagged', status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(match))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(wrongPlatform))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(lowScore))
      await writeFile(join(queueDir, 'item-004.json'), JSON.stringify(wrongType))

      const items = await queue.list({platform: 'reddit', qualityAbove: 0.85, contentType: 'standard'})
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('item-001')
    })

    it('qualityAbove uses strict greater-than comparison', async () => {
      await mkdir(queueDir, {recursive: true})
      // Exactly at threshold should NOT pass
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', qualityScore: 0.90})))
      // Just above should pass
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(makeItem({id: 'item-002', qualityScore: 0.91})))

      const items = await queue.list({qualityAbove: 0.90})
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('item-002')
    })
  })

  describe('getById()', () => {
    it('returns item when found', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const result = await queue.getById('item-001')
      expect(result.id).toBe('item-001')
      expect(result.platform).toBe('reddit')
    })

    it('throws ReviewItemNotFoundError when file does not exist', async () => {
      await mkdir(queueDir, {recursive: true})

      await expect(queue.getById('nonexistent')).rejects.toThrow(ReviewItemNotFoundError)
    })

    it('throws ReviewItemNotFoundError when file is invalid', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'bad-item.json'), JSON.stringify({id: 'bad-item'}))

      await expect(queue.getById('bad-item')).rejects.toThrow(ReviewItemNotFoundError)
    })
  })

  describe('enqueue()', () => {
    it('writes items as JSON files', async () => {
      const item = makeItem({id: 'item-001'})
      await queue.enqueue([item])

      const raw = await readFile(join(queueDir, 'item-001.json'), 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      expect(parsed.id).toBe('item-001')
    })

    it('creates directory if it does not exist', async () => {
      const item = makeItem({id: 'item-001'})
      await queue.enqueue([item])

      const files = await readdir(queueDir)
      expect(files).toContain('item-001.json')
    })

    it('writes multiple items atomically', async () => {
      const items = [
        makeItem({id: 'item-001'}),
        makeItem({id: 'item-002', platform: 'tiktok'}),
      ]
      await queue.enqueue(items)

      const files = await readdir(queueDir)
      expect(files).toContain('item-001.json')
      expect(files).toContain('item-002.json')
      // No .tmp files remaining
      expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
    })

    it('validates items before writing', async () => {
      const invalid = {id: '', runId: 'not-uuid'} as unknown as ReviewItem
      await expect(queue.enqueue([invalid])).rejects.toThrow()
    })
  })

  describe('getStats()', () => {
    it('returns correct counts by status', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'pending'})))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(makeItem({id: 'item-002', status: 'pending'})))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(makeItem({id: 'item-003', status: 'approved'})))
      await writeFile(join(queueDir, 'item-004.json'), JSON.stringify(makeItem({id: 'item-004', status: 'rejected'})))

      const stats = await queue.getStats()
      expect(stats.pending).toBe(2)
      expect(stats.approved).toBe(1)
      expect(stats.edited).toBe(0)
      expect(stats.rejected).toBe(1)
      expect(stats.total).toBe(4)
    })

    it('returns zeros when queue is empty', async () => {
      const stats = await queue.getStats()
      expect(stats).toEqual({pending: 0, approved: 0, edited: 0, rejected: 0, total: 0})
    })
  })

  describe('approve()', () => {
    it('sets status to approved and populates userFeedback', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001', status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const result = await queue.approve('item-001')
      expect(result.status).toBe('approved')
      expect(result.userFeedback).toBeDefined()
      expect(result.userFeedback!.decision).toBe('approved')
      expect(result.userFeedback!.editedAt).toBeDefined()
    })

    it('includes notes when provided', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      const result = await queue.approve('item-001', 'Great content')
      expect(result.userFeedback!.notes).toBe('Great content')
    })

    it('allows approve from edited status', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'edited'})))

      const result = await queue.approve('item-001')
      expect(result.status).toBe('approved')
    })

    it('throws InvalidStatusTransitionError for approved → approved', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'approved'})))

      await expect(queue.approve('item-001')).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('throws InvalidStatusTransitionError for rejected → approved', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'rejected'})))

      await expect(queue.approve('item-001')).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('throws ReviewItemNotFoundError for non-existent item', async () => {
      await mkdir(queueDir, {recursive: true})
      await expect(queue.approve('nonexistent')).rejects.toThrow(ReviewItemNotFoundError)
    })

    it('persists approved item to disk atomically', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      await queue.approve('item-001')
      const raw = await readFile(join(queueDir, 'item-001.json'), 'utf-8')
      const persisted = JSON.parse(raw) as Record<string, unknown>
      expect(persisted.status).toBe('approved')
      // No .tmp files remaining
      const files = await readdir(queueDir)
      expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
    })

    it('updates the updatedAt timestamp', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001', updatedAt: '2026-01-01T00:00:00Z'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const result = await queue.approve('item-001')
      expect(result.updatedAt).not.toBe('2026-01-01T00:00:00Z')
    })
  })

  describe('reject()', () => {
    it('sets status to rejected with reason', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      const result = await queue.reject('item-001', 'Off-brand tone')
      expect(result.status).toBe('rejected')
      expect(result.userFeedback).toBeDefined()
      expect(result.userFeedback!.decision).toBe('rejected')
      expect(result.userFeedback!.reason).toBe('Off-brand tone')
    })

    it('includes feedback when provided', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      const result = await queue.reject('item-001', 'Inaccurate', 'Check dates')
      expect(result.userFeedback!.notes).toBe('Check dates')
    })

    it('allows reject from edited status', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'edited'})))

      const result = await queue.reject('item-001', 'Still off-brand')
      expect(result.status).toBe('rejected')
    })

    it('throws InvalidStatusTransitionError for approved → rejected', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'approved'})))

      await expect(queue.reject('item-001', 'reason')).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('throws InvalidStatusTransitionError for rejected → rejected', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'rejected'})))

      await expect(queue.reject('item-001', 'reason')).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('throws ReviewItemNotFoundError for non-existent item', async () => {
      await mkdir(queueDir, {recursive: true})
      await expect(queue.reject('nonexistent', 'reason')).rejects.toThrow(ReviewItemNotFoundError)
    })

    it('persists rejected item to disk atomically', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      await queue.reject('item-001', 'Off-brand')
      const raw = await readFile(join(queueDir, 'item-001.json'), 'utf-8')
      const persisted = JSON.parse(raw) as Record<string, unknown>
      expect(persisted.status).toBe('rejected')
    })
  })

  describe('edit()', () => {
    it('preserves original in editHistory and applies edits', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001', content: {title: 'Old title', body: 'Old body', platformMeta: {}}})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const result = await queue.edit('item-001', {title: 'New title'})
      expect(result.content.title).toBe('New title')
      expect(result.editHistory).toHaveLength(1)
      expect(result.editHistory[0].field).toBe('title')
      expect(result.editHistory[0].originalValue).toBe('Old title')
      expect(result.editHistory[0].newValue).toBe('New title')
    })

    it('sets status to approved after edit', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      const result = await queue.edit('item-001', {body: 'Updated body'})
      expect(result.status).toBe('approved')
      expect(result.userFeedback!.decision).toBe('approved')
    })

    it('includes notes when provided', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      const result = await queue.edit('item-001', {body: 'Updated body'}, 'Fixed typo')
      expect(result.userFeedback!.notes).toBe('Fixed typo')
    })

    it('handles multiple field edits', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001', content: {title: 'Title', body: 'Body', cta: 'Click here', platformMeta: {}}})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const result = await queue.edit('item-001', {title: 'New Title', body: 'New Body', cta: 'Learn more'})
      expect(result.editHistory).toHaveLength(3)
      expect(result.content.title).toBe('New Title')
      expect(result.content.body).toBe('New Body')
      expect(result.content.cta).toBe('Learn more')
    })

    it('allows edit from edited status', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'edited'})))

      const result = await queue.edit('item-001', {body: 'Updated'})
      expect(result.status).toBe('approved')
    })

    it('throws InvalidStatusTransitionError for approved → edit', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'approved'})))

      await expect(queue.edit('item-001', {body: 'x'})).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('throws InvalidStatusTransitionError for rejected → edit', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'rejected'})))

      await expect(queue.edit('item-001', {body: 'x'})).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('throws ReviewItemNotFoundError for non-existent item', async () => {
      await mkdir(queueDir, {recursive: true})
      await expect(queue.edit('nonexistent', {body: 'x'})).rejects.toThrow(ReviewItemNotFoundError)
    })

    it('persists edited item to disk atomically', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001'})))

      await queue.edit('item-001', {body: 'Updated body'})
      const raw = await readFile(join(queueDir, 'item-001.json'), 'utf-8')
      const persisted = JSON.parse(raw) as Record<string, unknown>
      expect(persisted.status).toBe('approved')
      const files = await readdir(queueDir)
      expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
    })

    it('handles non-string original values in editHistory', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001'})
      // Set a non-string field value
      ;(item.content as Record<string, unknown>).customField = undefined
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const result = await queue.edit('item-001', {customField: 'new value'})
      expect(result.editHistory).toHaveLength(1)
      expect(result.editHistory[0].originalValue).toBe('""')
    })
  })

  describe('bulkApprove()', () => {
    it('approves all pending items matching filter', async () => {
      await mkdir(queueDir, {recursive: true})
      const p1 = makeItem({id: 'item-001', platform: 'reddit', status: 'pending'})
      const p2 = makeItem({id: 'item-002', platform: 'reddit', status: 'pending'})
      const t1 = makeItem({id: 'item-003', platform: 'tiktok', status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(p1))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(p2))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(t1))

      const approved = await queue.bulkApprove({platform: 'reddit'})
      expect(approved).toHaveLength(2)
      expect(approved.every((item) => item.status === 'approved')).toBe(true)
      expect(approved.every((item) => item.platform === 'reddit')).toBe(true)
    })

    it('only approves pending items, skips non-pending', async () => {
      await mkdir(queueDir, {recursive: true})
      const pending = makeItem({id: 'item-001', platform: 'reddit', status: 'pending'})
      const already = makeItem({id: 'item-002', platform: 'reddit', status: 'approved'})
      const rejected = makeItem({id: 'item-003', platform: 'reddit', status: 'rejected'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(pending))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(already))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(rejected))

      const approved = await queue.bulkApprove({platform: 'reddit'})
      expect(approved).toHaveLength(1)
      expect(approved[0].id).toBe('item-001')
    })

    it('returns empty array when no items match', async () => {
      await mkdir(queueDir, {recursive: true})
      const item = makeItem({id: 'item-001', platform: 'tiktok', status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(item))

      const approved = await queue.bulkApprove({platform: 'reddit'})
      expect(approved).toHaveLength(0)
    })

    it('persists all approved items to disk', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'pending'})))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(makeItem({id: 'item-002', status: 'pending'})))

      await queue.bulkApprove({})

      const raw1 = JSON.parse(await readFile(join(queueDir, 'item-001.json'), 'utf-8')) as Record<string, unknown>
      const raw2 = JSON.parse(await readFile(join(queueDir, 'item-002.json'), 'utf-8')) as Record<string, unknown>
      expect(raw1.status).toBe('approved')
      expect(raw2.status).toBe('approved')
    })

    it('applies qualityAbove filter in bulk approve', async () => {
      await mkdir(queueDir, {recursive: true})
      const high = makeItem({id: 'item-001', qualityScore: 0.95, status: 'pending'})
      const low = makeItem({id: 'item-002', qualityScore: 0.60, status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(high))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(low))

      const approved = await queue.bulkApprove({qualityAbove: 0.90})
      expect(approved).toHaveLength(1)
      expect(approved[0].id).toBe('item-001')
    })

    it('sets userFeedback notes to "Bulk approved"', async () => {
      await mkdir(queueDir, {recursive: true})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(makeItem({id: 'item-001', status: 'pending'})))

      const approved = await queue.bulkApprove({})
      expect(approved[0].userFeedback!.notes).toBe('Bulk approved')
    })

    it('combines platform and qualityAbove filters', async () => {
      await mkdir(queueDir, {recursive: true})
      const match = makeItem({id: 'item-001', platform: 'reddit', qualityScore: 0.95, status: 'pending'})
      const wrongPlatform = makeItem({id: 'item-002', platform: 'tiktok', qualityScore: 0.95, status: 'pending'})
      const lowScore = makeItem({id: 'item-003', platform: 'reddit', qualityScore: 0.50, status: 'pending'})
      await writeFile(join(queueDir, 'item-001.json'), JSON.stringify(match))
      await writeFile(join(queueDir, 'item-002.json'), JSON.stringify(wrongPlatform))
      await writeFile(join(queueDir, 'item-003.json'), JSON.stringify(lowScore))

      const approved = await queue.bulkApprove({platform: 'reddit', qualityAbove: 0.90})
      expect(approved).toHaveLength(1)
      expect(approved[0].id).toBe('item-001')
    })
  })
})
