import {describe, it, expect, vi, beforeEach} from 'vitest'

import {RejectionRecorder, extractKeywords} from '../../../src/lib/agents/rejection-recorder.js'
import type {AgentMemoryStore} from '../../../src/lib/agents/memory-store.js'

describe('extractKeywords', () => {
  it('filters stop words', () => {
    const result = extractKeywords('the best meditation for stress')
    expect(result).not.toContain('the')
    expect(result).not.toContain('for')
    expect(result).toContain('best')
    expect(result).toContain('meditation')
    expect(result).toContain('stress')
  })

  it('lowercases tokens', () => {
    const result = extractKeywords('Meditation Benefits Corporate')
    expect(result).toContain('meditation')
    expect(result).toContain('benefits')
    expect(result).toContain('corporate')
    expect(result).not.toContain('Meditation')
  })

  it('deduplicates tokens', () => {
    const result = extractKeywords('meditation meditation wellness wellness app')
    const meditationCount = result.filter((t) => t === 'meditation').length
    expect(meditationCount).toBe(1)
    expect(result).toContain('wellness')
    expect(result).toContain('app')
  })

  it('filters tokens shorter than 3 characters', () => {
    const result = extractKeywords('AI ML NLP deep learning is ok')
    expect(result).not.toContain('ai')
    expect(result).not.toContain('ml')
    expect(result).toContain('nlp')
    expect(result).toContain('deep')
    expect(result).toContain('learning')
  })

  it('splits on punctuation', () => {
    const result = extractKeywords('content-marketing, social.media, hashtag_strategy')
    expect(result).toContain('content')
    expect(result).toContain('marketing')
    expect(result).toContain('social')
    expect(result).toContain('media')
    expect(result).toContain('hashtag')
    expect(result).toContain('strategy')
  })

  it('returns empty array for text with only stop words', () => {
    const result = extractKeywords('the a an is are was')
    expect(result).toEqual([])
  })

  it('handles empty string', () => {
    const result = extractKeywords('')
    expect(result).toEqual([])
  })
})

describe('RejectionRecorder', () => {
  let mockMemoryStore: {
    addEntry: ReturnType<typeof vi.fn>
    load: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }
  let recorder: RejectionRecorder

  beforeEach(() => {
    mockMemoryStore = {
      addEntry: vi.fn().mockResolvedValue(undefined),
      load: vi.fn(),
      save: vi.fn(),
      clear: vi.fn(),
    }
    recorder = new RejectionRecorder(mockMemoryStore as unknown as AgentMemoryStore)
  })

  it('calls AgentMemoryStore.addEntry() with correct agent name', async () => {
    await recorder.recordRejection({
      contentItemId: 'item-123',
      rejectedAngle: 'meditation benefits',
      rejectionReason: 'Too generic',
      agentName: 'trend-scout',
    })

    expect(mockMemoryStore.addEntry).toHaveBeenCalledTimes(1)
    expect(mockMemoryStore.addEntry.mock.calls[0][0]).toBe('trend-scout')
  })

  it('creates entry with type: rejection', async () => {
    await recorder.recordRejection({
      contentItemId: 'item-123',
      rejectedAngle: 'meditation benefits',
      rejectionReason: 'Too generic',
      agentName: 'trend-scout',
    })

    const entry = mockMemoryStore.addEntry.mock.calls[0][1]
    expect(entry.type).toBe('rejection')
    expect(entry.source).toBe('review-queue')
    expect(entry.confidence).toBe(1.0)
  })

  it('extracts keywords from rejected angle and stores in content', async () => {
    await recorder.recordRejection({
      contentItemId: 'item-123',
      rejectedAngle: 'meditation benefits for corporate productivity',
      rejectionReason: 'Too generic',
      agentName: 'trend-scout',
    })

    const entry = mockMemoryStore.addEntry.mock.calls[0][1]
    const content = JSON.parse(entry.content)
    expect(content.keywords).toContain('meditation')
    expect(content.keywords).toContain('benefits')
    expect(content.keywords).toContain('corporate')
    expect(content.keywords).toContain('productivity')
    expect(content.keywords).toContain('generic')
  })

  it('stores content item ID and rejection reason in content', async () => {
    await recorder.recordRejection({
      contentItemId: 'item-xyz-789',
      rejectedAngle: 'competitor pricing comparison',
      rejectionReason: 'Legal concerns',
      agentName: 'competitor-analyst',
    })

    const entry = mockMemoryStore.addEntry.mock.calls[0][1]
    const content = JSON.parse(entry.content)
    expect(content.contentItemId).toBe('item-xyz-789')
    expect(content.rejectedAngle).toBe('competitor pricing comparison')
    expect(content.rejectionReason).toBe('Legal concerns')
    expect(content.agentName).toBe('competitor-analyst')
    expect(content.confidence).toBe(1.0)
  })

  it('generates a runId that includes rejection prefix', async () => {
    await recorder.recordRejection({
      contentItemId: 'item-123',
      rejectedAngle: 'test angle',
      rejectionReason: 'test reason',
      agentName: 'trend-scout',
    })

    const entry = mockMemoryStore.addEntry.mock.calls[0][1]
    expect(entry.runId).toMatch(/^rejection-/)
  })
})
