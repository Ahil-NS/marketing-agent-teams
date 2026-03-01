import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Deprioritizer, calculateSimilarity} from '../../../src/lib/agents/deprioritizer.js'
import type {AgentMemoryStore} from '../../../src/lib/agents/memory-store.js'
import type {AgentMemoryState} from '../../../src/lib/agents/types.js'

function makeRejectionEntry(overrides: {
  rejectedAngle: string
  rejectionReason: string
  keywords: string[]
  timestamp?: string
  agentName?: string
  contentItemId?: string
}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    runId: 'rejection-test',
    timestamp: overrides.timestamp ?? '2026-03-01T10:00:00.000Z',
    type: 'rejection' as const,
    content: JSON.stringify({
      id: '550e8400-e29b-41d4-a716-446655440000',
      contentItemId: overrides.contentItemId ?? 'item-1',
      rejectedAngle: overrides.rejectedAngle,
      rejectionReason: overrides.rejectionReason,
      agentName: overrides.agentName ?? 'trend-scout',
      timestamp: overrides.timestamp ?? '2026-03-01T10:00:00.000Z',
      keywords: overrides.keywords,
      confidence: 1.0,
    }),
    source: 'review-queue',
    confidence: 1.0,
  }
}

function makeEmptyState(agentName: string): AgentMemoryState {
  return {
    agentName,
    lastRunId: null,
    lastRunAt: null,
    entries: [],
    metadata: {},
  }
}

describe('calculateSimilarity', () => {
  it('returns 1.0 for identical keyword sets', () => {
    const result = calculateSimilarity(
      ['meditation', 'benefits', 'stress'],
      ['meditation', 'benefits', 'stress'],
    )
    expect(result).toBe(1.0)
  })

  it('returns 0.0 for completely disjoint keyword sets', () => {
    const result = calculateSimilarity(
      ['meditation', 'benefits', 'stress'],
      ['cooking', 'recipes', 'dinner'],
    )
    expect(result).toBe(0.0)
  })

  it('returns correct value for partial overlap', () => {
    // Intersection: {meditation, stress} = 2
    // Union: {meditation, benefits, stress, relief, mindfulness} = 5
    // Jaccard: 2/5 = 0.4
    const result = calculateSimilarity(
      ['meditation', 'benefits', 'stress'],
      ['meditation', 'stress', 'relief', 'mindfulness'],
    )
    expect(result).toBeCloseTo(0.4, 5)
  })

  it('returns 0.0 for two empty sets', () => {
    const result = calculateSimilarity([], [])
    expect(result).toBe(0.0)
  })

  it('returns 0.0 when one set is empty and other is not', () => {
    const result = calculateSimilarity([], ['meditation', 'stress'])
    expect(result).toBe(0.0)
  })

  it('handles duplicate keywords within a set', () => {
    // Duplicates are collapsed to a set, so effective sets are the same
    const result = calculateSimilarity(
      ['meditation', 'meditation', 'stress'],
      ['meditation', 'stress'],
    )
    expect(result).toBe(1.0)
  })
})

describe('Deprioritizer', () => {
  let mockMemoryStore: {
    load: ReturnType<typeof vi.fn>
    addEntry: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }
  let deprioritizer: Deprioritizer

  beforeEach(() => {
    mockMemoryStore = {
      load: vi.fn(),
      addEntry: vi.fn(),
      save: vi.fn(),
      clear: vi.fn(),
    }
    deprioritizer = new Deprioritizer(mockMemoryStore as unknown as AgentMemoryStore)
  })

  it('returns formatted string with rejected angles', async () => {
    const state: AgentMemoryState = {
      ...makeEmptyState('trend-scout'),
      entries: [
        makeRejectionEntry({
          rejectedAngle: 'meditation benefits for corporate productivity',
          rejectionReason: 'Too generic, already covered this angle',
          keywords: ['meditation', 'benefits', 'corporate', 'productivity'],
          timestamp: '2026-03-01T10:00:00.000Z',
        }),
      ],
    }
    mockMemoryStore.load.mockResolvedValue(state)

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    expect(result).toContain('Previously Rejected Content Angles')
    expect(result).toContain('meditation benefits for corporate productivity')
    expect(result).toContain('Too generic, already covered this angle')
    expect(result).toContain('2026-03-01')
  })

  it('returns empty string when no rejections exist', async () => {
    mockMemoryStore.load.mockResolvedValue(makeEmptyState('trend-scout'))

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    expect(result).toBe('')
  })

  it('groups similar rejections (keyword overlap >= 50%)', async () => {
    const state: AgentMemoryState = {
      ...makeEmptyState('trend-scout'),
      entries: [
        makeRejectionEntry({
          rejectedAngle: 'meditation benefits for stress',
          rejectionReason: 'Covered already',
          keywords: ['meditation', 'benefits', 'stress'],
        }),
        // This has 2/4 overlap with the first (meditation, stress) => Jaccard = 2/4 = 0.5
        makeRejectionEntry({
          rejectedAngle: 'meditation tips for stress relief',
          rejectionReason: 'Too similar',
          keywords: ['meditation', 'stress', 'relief'],
          contentItemId: 'item-2',
        }),
        // Completely different topic — should be its own group
        makeRejectionEntry({
          rejectedAngle: 'competitor pricing analysis',
          rejectionReason: 'Legal concerns',
          keywords: ['competitor', 'pricing', 'analysis'],
          contentItemId: 'item-3',
        }),
      ],
    }
    mockMemoryStore.load.mockResolvedValue(state)

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    // Should have 2 numbered items (the two similar ones are grouped, competitor is separate)
    const numberedItems = result.match(/^\d+\./gm) ?? []
    expect(numberedItems).toHaveLength(2)
    expect(result).toContain('meditation benefits for stress')
    expect(result).toContain('competitor pricing analysis')
  })

  it('includes rejection reasons and dates in context', async () => {
    const state: AgentMemoryState = {
      ...makeEmptyState('trend-scout'),
      entries: [
        makeRejectionEntry({
          rejectedAngle: 'outdated TikTok algorithm changes',
          rejectionReason: 'Information is no longer relevant',
          keywords: ['outdated', 'tiktok', 'algorithm', 'changes'],
          timestamp: '2026-02-27T09:00:00.000Z',
        }),
      ],
    }
    mockMemoryStore.load.mockResolvedValue(state)

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    expect(result).toContain('Reason: Information is no longer relevant')
    expect(result).toContain('rejected 2026-02-27')
  })

  it('skips entries that are not of type rejection', async () => {
    const state: AgentMemoryState = {
      ...makeEmptyState('trend-scout'),
      entries: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          runId: 'learning-1',
          timestamp: '2026-03-01T10:00:00.000Z',
          type: 'learning',
          content: 'Some learned pattern',
          source: 'agent-self',
          confidence: 0.8,
        },
      ],
    }
    mockMemoryStore.load.mockResolvedValue(state)

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    expect(result).toBe('')
  })

  it('skips entries with corrupted JSON content', async () => {
    const state: AgentMemoryState = {
      ...makeEmptyState('trend-scout'),
      entries: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          runId: 'rejection-corrupt',
          timestamp: '2026-03-01T10:00:00.000Z',
          type: 'rejection',
          content: 'not valid json {{{',
          source: 'review-queue',
          confidence: 1.0,
        },
        makeRejectionEntry({
          rejectedAngle: 'valid angle',
          rejectionReason: 'valid reason',
          keywords: ['valid', 'angle'],
        }),
      ],
    }
    mockMemoryStore.load.mockResolvedValue(state)

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    // Should still include the valid entry
    expect(result).toContain('valid angle')
    const numberedItems = result.match(/^\d+\./gm) ?? []
    expect(numberedItems).toHaveLength(1)
  })

  it('includes DO NOT instruction in context', async () => {
    const state: AgentMemoryState = {
      ...makeEmptyState('trend-scout'),
      entries: [
        makeRejectionEntry({
          rejectedAngle: 'test angle',
          rejectionReason: 'test reason',
          keywords: ['test'],
        }),
      ],
    }
    mockMemoryStore.load.mockResolvedValue(state)

    const result = await deprioritizer.buildDeprioritizationContext('trend-scout')

    expect(result).toContain('DO NOT suggest content related to these previously rejected angles')
    expect(result).toContain('Use pattern matching: avoid similar topics, not just exact matches')
  })
})
