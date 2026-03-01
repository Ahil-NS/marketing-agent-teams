import {existsSync} from 'node:fs'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {ViralTracker} from '../../../src/lib/orchestrator/viral-tracker.js'

describe('ViralTracker', () => {
  let tempDir: string
  let trackingPath: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mat-viral-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(tempDir, {recursive: true})
    trackingPath = join(tempDir, 'viral-tracking.json')
  })

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, {recursive: true, force: true})
    }
  })

  // ── Load ──────────────────────────────────────────────────────────────────

  describe('load', () => {
    it('starts fresh when tracking file does not exist', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      expect(tracker.getProcessedCount()).toBe(0)
    })

    it('loads existing tracking state from disk', async () => {
      const state = {
        processedPosts: {
          'reddit:post-1': {detectedAt: '2026-03-01T00:00:00Z', derivativeTaskId: 'task-1'},
        },
      }
      await writeFile(trackingPath, JSON.stringify(state), 'utf-8')

      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      expect(tracker.getProcessedCount()).toBe(1)
      expect(tracker.hasBeenProcessed('reddit', 'post-1')).toBe(true)
    })

    it('throws on corrupt tracking state', async () => {
      await writeFile(trackingPath, '{"processedPosts": "invalid"}', 'utf-8')

      const tracker = new ViralTracker(trackingPath)
      await expect(tracker.load()).rejects.toThrow(/Corrupt viral tracking state/)
    })

    it('throws on invalid JSON', async () => {
      await writeFile(trackingPath, 'not-json', 'utf-8')

      const tracker = new ViralTracker(trackingPath)
      await expect(tracker.load()).rejects.toThrow()
    })
  })

  // ── hasBeenProcessed ──────────────────────────────────────────────────────

  describe('hasBeenProcessed', () => {
    it('returns false for unprocessed post', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      expect(tracker.hasBeenProcessed('reddit', 'post-new')).toBe(false)
    })

    it('returns true for processed post (AC6)', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')
      expect(tracker.hasBeenProcessed('reddit', 'post-1')).toBe(true)
    })

    it('same post ID on different platforms are independent (AC6)', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')
      expect(tracker.hasBeenProcessed('reddit', 'post-1')).toBe(true)
      expect(tracker.hasBeenProcessed('tiktok', 'post-1')).toBe(false)
    })

    it('different posts on same platform are processed independently (AC6)', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-a', '2026-03-01T00:00:00Z', 'task-a')
      expect(tracker.hasBeenProcessed('reddit', 'post-a')).toBe(true)
      expect(tracker.hasBeenProcessed('reddit', 'post-b')).toBe(false)
    })
  })

  // ── markProcessed ─────────────────────────────────────────────────────────

  describe('markProcessed', () => {
    it('persists to disk immediately', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')

      // Verify file was written
      expect(existsSync(trackingPath)).toBe(true)
      const raw = await readFile(trackingPath, 'utf-8')
      const state = JSON.parse(raw) as {processedPosts: Record<string, unknown>}
      expect(state.processedPosts['reddit:post-1']).toBeDefined()
    })

    it('state survives process restart (load → mark → new instance → load)', async () => {
      const tracker1 = new ViralTracker(trackingPath)
      await tracker1.load()
      await tracker1.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')

      // Simulate restart: new instance loading from the same file
      const tracker2 = new ViralTracker(trackingPath)
      await tracker2.load()
      expect(tracker2.hasBeenProcessed('reddit', 'post-1')).toBe(true)
      expect(tracker2.getProcessedCount()).toBe(1)
    })

    it('appends new entries without clobbering existing ones', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')
      await tracker.markProcessed('tiktok', 'post-2', '2026-03-01T01:00:00Z', 'task-2')

      expect(tracker.getProcessedCount()).toBe(2)
      expect(tracker.hasBeenProcessed('reddit', 'post-1')).toBe(true)
      expect(tracker.hasBeenProcessed('tiktok', 'post-2')).toBe(true)
    })
  })

  // ── Atomic write pattern ──────────────────────────────────────────────────

  describe('atomic writes', () => {
    it('does not leave .tmp files after successful write', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')

      const tmpPath = `${trackingPath}.tmp`
      expect(existsSync(tmpPath)).toBe(false)
    })

    it('creates directory if it does not exist', async () => {
      const nestedPath = join(tempDir, 'nested', 'state', 'viral-tracking.json')
      const tracker = new ViralTracker(nestedPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'post-1', '2026-03-01T00:00:00Z', 'task-1')

      expect(existsSync(nestedPath)).toBe(true)
    })
  })

  // ── getProcessedCount ─────────────────────────────────────────────────────

  describe('getProcessedCount', () => {
    it('returns 0 when empty', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      expect(tracker.getProcessedCount()).toBe(0)
    })

    it('returns correct count after multiple markProcessed calls', async () => {
      const tracker = new ViralTracker(trackingPath)
      await tracker.load()
      await tracker.markProcessed('reddit', 'p1', '2026-03-01T00:00:00Z', 't1')
      await tracker.markProcessed('reddit', 'p2', '2026-03-01T00:00:00Z', 't2')
      await tracker.markProcessed('tiktok', 'p3', '2026-03-01T00:00:00Z', 't3')
      expect(tracker.getProcessedCount()).toBe(3)
    })
  })
})
