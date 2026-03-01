import {describe, expect, it} from 'vitest'

import {applyQualityGate, evaluateCombinedQualityGate} from '../../../src/lib/agents/quality.js'
import type {BrandGuardianOutput} from '../../../src/lib/schemas/quality-schema.js'
import type {FactCheckReport} from '../../../src/lib/schemas/fact-check-schema.js'
import type {SensitivityReport} from '../../../src/lib/schemas/sensitivity-schema.js'

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

const passingFactCheck: FactCheckReport = {
  contentItemId: 'item-001',
  claimsFound: 1,
  verdicts: [{
    claim: {claimText: '90% of users', claimType: 'statistic', location: {startIndex: 0, endIndex: 12}},
    verdict: 'verified',
    confidence: 90,
    evidence: 'Confirmed',
    sources: ['https://example.com'],
  }],
  overallAccuracy: 90,
  recommendation: 'pass',
  summary: 'All claims verified.',
}

const blockingFactCheck: FactCheckReport = {
  ...passingFactCheck,
  recommendation: 'block',
  overallAccuracy: 15,
  summary: 'False claims detected.',
}

const needsRevisionFactCheck: FactCheckReport = {
  ...passingFactCheck,
  recommendation: 'needs-revision',
  overallAccuracy: 45,
  summary: 'Multiple unverifiable claims.',
}

const caveatsFactCheck: FactCheckReport = {
  ...passingFactCheck,
  recommendation: 'pass-with-caveats',
  overallAccuracy: 65,
  summary: 'Some claims need hedging language.',
}

const cleanSensitivity: SensitivityReport = {
  contentItemId: 'item-001',
  flags: [],
  overallSeverity: 'clear',
  recommendation: 'pass',
  summary: 'No sensitivity issues.',
}

const criticalSensitivity: SensitivityReport = {
  contentItemId: 'item-001',
  flags: [{
    flaggedText: 'offensive text',
    category: 'racial',
    severity: 'critical',
    explanation: 'Racial stereotype',
    location: {startIndex: 0, endIndex: 14},
  }],
  overallSeverity: 'critical',
  recommendation: 'block',
  summary: 'Critical racial sensitivity issue.',
}

const highSensitivity: SensitivityReport = {
  ...cleanSensitivity,
  overallSeverity: 'high',
  recommendation: 'block',
  summary: 'High severity issue found.',
}

const mediumSensitivity: SensitivityReport = {
  ...cleanSensitivity,
  overallSeverity: 'medium',
  recommendation: 'pass-with-warnings',
  summary: 'Medium sensitivity flag.',
}

const needsRevisionSensitivity: SensitivityReport = {
  ...cleanSensitivity,
  overallSeverity: 'medium',
  recommendation: 'needs-revision',
  summary: 'Sensitivity needs revision.',
}

describe('evaluateCombinedQualityGate', () => {
  it('returns pass when both reports pass', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: passingFactCheck,
      sensitivityReport: cleanSensitivity,
    })

    expect(result.overallRecommendation).toBe('pass')
    expect(result.blockReasons).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('returns block when fact check blocks', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: blockingFactCheck,
      sensitivityReport: cleanSensitivity,
    })

    expect(result.overallRecommendation).toBe('block')
    expect(result.blockReasons).toHaveLength(1)
    expect(result.blockReasons[0]).toContain('Fact Check')
  })

  it('returns block when sensitivity is critical', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: passingFactCheck,
      sensitivityReport: criticalSensitivity,
    })

    expect(result.overallRecommendation).toBe('block')
    expect(result.blockReasons).toHaveLength(1)
    expect(result.blockReasons[0]).toContain('Sensitivity')
  })

  it('returns block when sensitivity is high severity', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      sensitivityReport: highSensitivity,
    })

    expect(result.overallRecommendation).toBe('block')
    expect(result.blockReasons[0]).toContain('Sensitivity')
  })

  it('returns needs-revision when fact check needs revision', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: needsRevisionFactCheck,
      sensitivityReport: cleanSensitivity,
    })

    expect(result.overallRecommendation).toBe('needs-revision')
  })

  it('returns needs-revision when sensitivity needs revision', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: passingFactCheck,
      sensitivityReport: needsRevisionSensitivity,
    })

    expect(result.overallRecommendation).toBe('needs-revision')
  })

  it('returns pass-with-warnings when sensitivity medium + fact check pass', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: passingFactCheck,
      sensitivityReport: mediumSensitivity,
    })

    expect(result.overallRecommendation).toBe('pass-with-warnings')
    expect(result.warnings).toHaveLength(1)
  })

  it('returns pass-with-warnings when fact check has caveats', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: caveatsFactCheck,
      sensitivityReport: cleanSensitivity,
    })

    expect(result.overallRecommendation).toBe('pass-with-warnings')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Fact Check')
  })

  it('returns pass when no sub-reports provided (both undefined)', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
    })

    expect(result.overallRecommendation).toBe('pass')
    expect(result.blockReasons).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('collects block reasons from all blocking reports', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: blockingFactCheck,
      sensitivityReport: criticalSensitivity,
    })

    expect(result.overallRecommendation).toBe('block')
    expect(result.blockReasons).toHaveLength(2)
    expect(result.blockReasons[0]).toContain('Fact Check')
    expect(result.blockReasons[1]).toContain('Sensitivity')
  })

  it('collects warnings from multiple warning reports', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: caveatsFactCheck,
      sensitivityReport: mediumSensitivity,
    })

    expect(result.overallRecommendation).toBe('pass-with-warnings')
    expect(result.warnings).toHaveLength(2)
  })

  it('block wins over needs-revision (worst-case wins)', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: blockingFactCheck,
      sensitivityReport: needsRevisionSensitivity,
    })

    expect(result.overallRecommendation).toBe('block')
  })

  it('includes contentItemId in result', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'my-content-42',
    })

    expect(result.contentItemId).toBe('my-content-42')
  })

  it('includes sub-reports in result', () => {
    const result = evaluateCombinedQualityGate({
      contentItemId: 'item-001',
      factCheckReport: passingFactCheck,
      sensitivityReport: cleanSensitivity,
      brandGuardianReport: {score: 85},
      complianceReport: {status: 'clean'},
    })

    expect(result.factCheckReport).toBe(passingFactCheck)
    expect(result.sensitivityReport).toBe(cleanSensitivity)
    expect(result.brandGuardianReport).toEqual({score: 85})
    expect(result.complianceReport).toEqual({status: 'clean'})
  })
})
