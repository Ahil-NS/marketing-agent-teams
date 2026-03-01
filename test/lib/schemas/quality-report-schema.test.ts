import {describe, expect, it} from 'vitest'

import {combinedQualityReportSchema} from '../../../src/lib/schemas/quality-report-schema.js'

const validFactCheckReport = {
  contentItemId: 'item-001',
  claimsFound: 1,
  verdicts: [{
    claim: {claimText: '90% of users agree', claimType: 'statistic' as const, location: {startIndex: 0, endIndex: 18}},
    verdict: 'verified' as const,
    confidence: 85,
    evidence: 'Confirmed by survey data',
    sources: ['https://example.com/survey'],
  }],
  overallAccuracy: 85,
  recommendation: 'pass' as const,
  summary: 'All claims verified.',
}

const validSensitivityReport = {
  contentItemId: 'item-001',
  flags: [{
    flaggedText: 'Only millennials get this',
    category: 'ageist' as const,
    severity: 'low' as const,
    explanation: 'Ageist language targeting a generation',
    location: {startIndex: 0, endIndex: 25},
  }],
  overallSeverity: 'low' as const,
  recommendation: 'pass-with-warnings' as const,
  summary: 'Minor ageist language detected.',
}

const validCombinedReport = {
  contentItemId: 'item-001',
  factCheckReport: validFactCheckReport,
  sensitivityReport: validSensitivityReport,
  brandGuardianReport: {score: 85},
  complianceReport: {violations: []},
  overallRecommendation: 'pass-with-warnings' as const,
  blockReasons: [],
  warnings: ['Sensitivity: Minor ageist language detected.'],
}

describe('combinedQualityReportSchema', () => {
  it('accepts report with all sub-reports present', () => {
    const result = combinedQualityReportSchema.safeParse(validCombinedReport)
    expect(result.success).toBe(true)
  })

  it('accepts report with only fact check (no sensitivity)', () => {
    const report = {
      contentItemId: 'item-002',
      factCheckReport: validFactCheckReport,
      overallRecommendation: 'pass' as const,
      blockReasons: [],
      warnings: [],
    }
    const result = combinedQualityReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('accepts report with only sensitivity (no fact check)', () => {
    const report = {
      contentItemId: 'item-003',
      sensitivityReport: validSensitivityReport,
      overallRecommendation: 'pass-with-warnings' as const,
      blockReasons: [],
      warnings: ['Minor sensitivity flag'],
    }
    const result = combinedQualityReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('accepts report with no sub-reports (both optional)', () => {
    const report = {
      contentItemId: 'item-004',
      overallRecommendation: 'pass' as const,
      blockReasons: [],
      warnings: [],
    }
    const result = combinedQualityReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects invalid overallRecommendation', () => {
    const result = combinedQualityReportSchema.safeParse({
      ...validCombinedReport,
      overallRecommendation: 'reject',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty contentItemId', () => {
    const result = combinedQualityReportSchema.safeParse({
      ...validCombinedReport,
      contentItemId: '',
    })
    expect(result.success).toBe(false)
  })
})
