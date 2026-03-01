import {describe, expect, it, vi} from 'vitest'

import {ContentRenderer} from '../../../src/lib/review-queue/content-renderer.js'
import type {ReviewItem, ReviewQueueStats} from '../../../src/lib/review-queue/types.js'

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-2026-03-01-001',
    runId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    status: 'pending',
    content: {
      title: 'Why meditation apps fail',
      body: 'A deep dive into meditation app UX.',
      platformMeta: {},
    },
    qualityScore: 0.92,
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

function mockCommand() {
  const logs: string[] = []
  return {
    log: vi.fn((msg: string) => logs.push(msg)),
    logs,
  }
}

describe('ContentRenderer', () => {
  describe('renderQueueTable()', () => {
    it('displays items grouped by platform', () => {
      const cmd = mockCommand()
      const items = [
        makeItem({id: 'item-001', platform: 'reddit'}),
        makeItem({id: 'item-002', platform: 'tiktok'}),
      ]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('Review Queue (2 items)')
      expect(output).toContain('Reddit (1 items)')
      expect(output).toContain('TikTok (1 items)')
    })

    it('shows quality scores as decimals', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', qualityScore: 0.92})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('0.92')
    })

    it('shows content type tag for non-standard types', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', contentType: 'compliance-flagged'})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('flagged')
    })

    it('shows trending tag for trending-derivative type', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', contentType: 'trending-derivative'})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('trending')
    })

    it('shows retry tag for retry type', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', contentType: 'retry'})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('retry')
    })

    it('does not show type tag for standard content', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', contentType: 'standard'})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      // Find the row containing item-001 and check it doesn't have a type tag
      const row = cmd.logs.find((l) => l.includes('item-001') && !l.includes('ID'))
      expect(row).toBeDefined()
      // Standard type should have empty tag (just spaces)
      expect(row).not.toMatch(/trending|flagged|retry/)
    })

    it('truncates preview to 50 chars max', () => {
      const cmd = mockCommand()
      const longTitle = 'A'.repeat(100)
      const items = [makeItem({id: 'item-001', content: {title: longTitle, body: 'body', platformMeta: {}}})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      // Should have truncated with "..."
      expect(output).toContain('...')
      // The truncated preview should be <= 50 chars
      expect(output).not.toContain(longTitle)
    })

    it('uses body as preview when title is absent', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', content: {body: 'Body text preview here', platformMeta: {}}})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('Body text preview here')
    })

    it('shows compliance flag count when items are flagged', () => {
      const cmd = mockCommand()
      const items = [
        makeItem({id: 'item-001', complianceFlags: ['ftc-disclosure']}),
        makeItem({id: 'item-002', complianceFlags: []}),
      ]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain('Compliance flags: 1 items flagged')
    })

    it('does not show compliance line when no items flagged', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001', complianceFlags: []})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).not.toContain('Compliance flags')
    })

    it('shows guidance to approve items', () => {
      const cmd = mockCommand()
      const items = [makeItem({id: 'item-001'})]

      ContentRenderer.renderQueueTable(cmd as any, items)

      const output = cmd.logs.join('\n')
      expect(output).toContain("Run 'mat review approve <id>' to approve items")
    })
  })

  describe('renderEmptyState()', () => {
    it('displays empty queue message', () => {
      const cmd = mockCommand()

      ContentRenderer.renderEmptyState(cmd as any)

      const output = cmd.logs.join('\n')
      expect(output).toContain('Review queue is empty')
    })

    it('shows guidance to run pipeline', () => {
      const cmd = mockCommand()

      ContentRenderer.renderEmptyState(cmd as any)

      const output = cmd.logs.join('\n')
      expect(output).toContain("Run 'mat run' to generate content first")
    })
  })

  describe('renderStats()', () => {
    it('displays stats correctly', () => {
      const cmd = mockCommand()
      const stats: ReviewQueueStats = {pending: 5, approved: 2, edited: 1, rejected: 0, total: 8}

      ContentRenderer.renderStats(cmd as any, stats)

      const output = cmd.logs.join('\n')
      expect(output).toContain('Queue Stats: 8 total')
      expect(output).toContain('Pending:  5')
      expect(output).toContain('Approved: 2')
      expect(output).toContain('Edited:   1')
      expect(output).toContain('Rejected: 0')
    })
  })
})
