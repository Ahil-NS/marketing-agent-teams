import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {ReviewQueue, ReviewItemNotFoundError} from '../../../src/lib/review-queue/index.js'
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
})
