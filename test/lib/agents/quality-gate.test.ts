import {describe, expect, it} from 'vitest'

import {applyQualityGate} from '../../../src/lib/agents/quality.js'
import type {BrandGuardianOutput} from '../../../src/lib/schemas/quality-schema.js'

function makeOutput(gateResults: BrandGuardianOutput['qualityGateResults']): BrandGuardianOutput {
  return {
    reviews: gateResults.map(gr => ({
      contentItemId: gr.contentItemId,
      qualityScore: gr.qualityScore,
      toneAlignment: gr.qualityScore,
      styleConsistency: gr.qualityScore,
      principleAdherence: gr.qualityScore,
      bannedPhraseViolations: [],
      issues: [],
      suggestions: [],
    })),
    qualityGateResults: gateResults,
    overallAssessment: {
      averageScore: gateResults.reduce((sum, r) => sum + r.qualityScore, 0) / (gateResults.length || 1),
      totalReviewed: gateResults.length,
      totalPassed: gateResults.filter(r => r.passed).length,
      totalBlocked: gateResults.filter(r => !r.passed).length,
    },
    learnedPatterns: [],
  }
}

describe('applyQualityGate', () => {
  it('passes items at or above threshold', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 70, threshold: 70, passed: true, blockedReasons: []},
      {contentItemId: 'item-2', qualityScore: 95, threshold: 70, passed: true, blockedReasons: []},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.passed).toEqual(['item-1', 'item-2'])
    expect(decision.blocked).toEqual([])
    expect(decision.blockReasons).toEqual({})
  })

  it('blocks items below threshold', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 69, threshold: 70, passed: false, blockedReasons: ['Tone too casual']},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.passed).toEqual([])
    expect(decision.blocked).toEqual(['item-1'])
    expect(decision.blockReasons['item-1']).toEqual(['Tone too casual'])
  })

  it('returns block reasons for each blocked item', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 45, threshold: 70, passed: false, blockedReasons: ['Tone too casual', 'Banned phrase detected']},
      {contentItemId: 'item-2', qualityScore: 30, threshold: 70, passed: false, blockedReasons: ['Complete rewrite needed']},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.blocked).toEqual(['item-1', 'item-2'])
    expect(decision.blockReasons['item-1']).toEqual(['Tone too casual', 'Banned phrase detected'])
    expect(decision.blockReasons['item-2']).toEqual(['Complete rewrite needed'])
  })

  it('handles all items passing', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 85, threshold: 70, passed: true, blockedReasons: []},
      {contentItemId: 'item-2', qualityScore: 90, threshold: 70, passed: true, blockedReasons: []},
      {contentItemId: 'item-3', qualityScore: 100, threshold: 70, passed: true, blockedReasons: []},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.passed).toHaveLength(3)
    expect(decision.blocked).toHaveLength(0)
  })

  it('handles all items blocked', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 20, threshold: 70, passed: false, blockedReasons: ['Major violations']},
      {contentItemId: 'item-2', qualityScore: 50, threshold: 70, passed: false, blockedReasons: ['Off-brand']},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.passed).toHaveLength(0)
    expect(decision.blocked).toHaveLength(2)
  })

  it('handles empty input', () => {
    const output: BrandGuardianOutput = {
      reviews: [{
        contentItemId: 'placeholder',
        qualityScore: 0,
        toneAlignment: 0,
        styleConsistency: 0,
        principleAdherence: 0,
        bannedPhraseViolations: [],
        issues: [],
        suggestions: [],
      }],
      qualityGateResults: [],
      overallAssessment: {averageScore: 0, totalReviewed: 1, totalPassed: 0, totalBlocked: 0},
      learnedPatterns: [],
    }

    const decision = applyQualityGate(output, 70)

    expect(decision.passed).toEqual([])
    expect(decision.blocked).toEqual([])
    expect(decision.blockReasons).toEqual({})
  })

  it('uses default threshold 70 when not specified', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 70, threshold: 70, passed: true, blockedReasons: []},
      {contentItemId: 'item-2', qualityScore: 69, threshold: 70, passed: false, blockedReasons: []},
    ])

    const decision = applyQualityGate(output)

    expect(decision.passed).toEqual(['item-1'])
    expect(decision.blocked).toEqual(['item-2'])
  })

  it('provides default block reason when blockedReasons is empty', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 50, threshold: 70, passed: false, blockedReasons: []},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.blockReasons['item-1']).toEqual(['Quality score 50 is below threshold 70'])
  })

  it('passes item at exact threshold boundary', () => {
    const output = makeOutput([
      {contentItemId: 'exact', qualityScore: 70, threshold: 70, passed: true, blockedReasons: []},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.passed).toEqual(['exact'])
    expect(decision.blocked).toEqual([])
  })

  it('blocks item one point below threshold', () => {
    const output = makeOutput([
      {contentItemId: 'just-below', qualityScore: 69, threshold: 70, passed: false, blockedReasons: ['Barely below threshold']},
    ])

    const decision = applyQualityGate(output, 70)

    expect(decision.blocked).toEqual(['just-below'])
  })

  it('supports custom threshold', () => {
    const output = makeOutput([
      {contentItemId: 'item-1', qualityScore: 92, threshold: 90, passed: true, blockedReasons: []},
      {contentItemId: 'item-2', qualityScore: 89, threshold: 90, passed: false, blockedReasons: ['Below 90 threshold']},
    ])

    const decision = applyQualityGate(output, 90)

    expect(decision.passed).toEqual(['item-1'])
    expect(decision.blocked).toEqual(['item-2'])
  })
})
