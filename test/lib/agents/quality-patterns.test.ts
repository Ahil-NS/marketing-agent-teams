import {describe, expect, it, vi, beforeEach} from 'vitest'

import {persistLearnedPatterns} from '../../../src/lib/agents/quality.js'
import {AgentMemoryStore} from '../../../src/lib/agents/memory-store.js'
import type {BrandGuardianOutput} from '../../../src/lib/schemas/quality-schema.js'

function makeOutput(patterns: BrandGuardianOutput['learnedPatterns']): BrandGuardianOutput {
  return {
    reviews: [{
      contentItemId: 'item-1',
      qualityScore: 80,
      toneAlignment: 80,
      styleConsistency: 80,
      principleAdherence: 80,
      bannedPhraseViolations: [],
      issues: [],
      suggestions: [],
    }],
    qualityGateResults: [{
      contentItemId: 'item-1',
      qualityScore: 80,
      threshold: 70,
      passed: true,
      blockedReasons: [],
    }],
    overallAssessment: {averageScore: 80, totalReviewed: 1, totalPassed: 1, totalBlocked: 0},
    learnedPatterns: patterns,
  }
}

describe('persistLearnedPatterns', () => {
  let mockMemoryStore: AgentMemoryStore

  beforeEach(() => {
    mockMemoryStore = {
      addEntry: vi.fn().mockResolvedValue(undefined),
      getContextForPrompt: vi.fn().mockResolvedValue(''),
      load: vi.fn(),
      save: vi.fn(),
      prune: vi.fn(),
      clear: vi.fn(),
    } as unknown as AgentMemoryStore
  })

  it('stores patterns via AgentMemoryStore.addEntry()', async () => {
    const output = makeOutput([
      {
        pattern: 'User prefers conversational tone for Instagram',
        patternType: 'tone-correction',
        confidence: 0.85,
        source: 'content-review',
      },
    ])

    await persistLearnedPatterns(output, 'run-123', mockMemoryStore)

    expect(mockMemoryStore.addEntry).toHaveBeenCalledTimes(1)
    expect(mockMemoryStore.addEntry).toHaveBeenCalledWith('brand-guardian', {
      runId: 'run-123',
      type: 'pattern',
      content: '[tone-correction] User prefers conversational tone for Instagram',
      source: 'quality-gate',
      confidence: 0.85,
    })
  })

  it('uses type "pattern" and source "quality-gate"', async () => {
    const output = makeOutput([
      {
        pattern: 'Replace superlative claims',
        patternType: 'phrase-replacement',
        confidence: 0.9,
        source: 'content-review',
      },
    ])

    await persistLearnedPatterns(output, 'run-456', mockMemoryStore)

    const callArgs = vi.mocked(mockMemoryStore.addEntry).mock.calls[0]
    expect(callArgs[1].type).toBe('pattern')
    expect(callArgs[1].source).toBe('quality-gate')
  })

  it('skips persistence when no patterns in output', async () => {
    const output = makeOutput([])

    await persistLearnedPatterns(output, 'run-789', mockMemoryStore)

    expect(mockMemoryStore.addEntry).not.toHaveBeenCalled()
  })

  it('uses confidence from agent output', async () => {
    const output = makeOutput([
      {
        pattern: 'Low confidence pattern',
        patternType: 'style-adjustment',
        confidence: 0.5,
        source: 'content-review',
      },
      {
        pattern: 'High confidence pattern',
        patternType: 'structure-change',
        confidence: 0.95,
        source: 'content-review',
      },
    ])

    await persistLearnedPatterns(output, 'run-abc', mockMemoryStore)

    expect(mockMemoryStore.addEntry).toHaveBeenCalledTimes(2)

    const firstCall = vi.mocked(mockMemoryStore.addEntry).mock.calls[0]
    expect(firstCall[1].confidence).toBe(0.5)

    const secondCall = vi.mocked(mockMemoryStore.addEntry).mock.calls[1]
    expect(secondCall[1].confidence).toBe(0.95)
  })

  it('stores multiple patterns individually', async () => {
    const output = makeOutput([
      {pattern: 'Pattern A', patternType: 'tone-correction', confidence: 0.8, source: 'content-review'},
      {pattern: 'Pattern B', patternType: 'style-adjustment', confidence: 0.7, source: 'content-review'},
      {pattern: 'Pattern C', patternType: 'phrase-replacement', confidence: 0.6, source: 'content-review'},
    ])

    await persistLearnedPatterns(output, 'run-multi', mockMemoryStore)

    expect(mockMemoryStore.addEntry).toHaveBeenCalledTimes(3)

    // Verify each pattern is stored with its patternType in the content
    const calls = vi.mocked(mockMemoryStore.addEntry).mock.calls
    expect(calls[0][1].content).toContain('[tone-correction]')
    expect(calls[1][1].content).toContain('[style-adjustment]')
    expect(calls[2][1].content).toContain('[phrase-replacement]')
  })

  it('uses the provided runId for each entry', async () => {
    const output = makeOutput([
      {pattern: 'Test', patternType: 'tone-correction', confidence: 0.8, source: 'content-review'},
    ])

    await persistLearnedPatterns(output, 'specific-run-id', mockMemoryStore)

    const callArgs = vi.mocked(mockMemoryStore.addEntry).mock.calls[0]
    expect(callArgs[1].runId).toBe('specific-run-id')
  })
})
