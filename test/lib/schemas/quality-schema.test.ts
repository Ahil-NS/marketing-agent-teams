import {describe, expect, it} from 'vitest'

import {
  brandGuardianOutputSchema,
  brandGuardianReviewSchema,
  qualityGateResultSchema,
  learnedPatternSchema,
  brandGuardianInputsSchema,
} from '../../../src/lib/schemas/quality-schema.js'

import fixture from '../../fixtures/responses/claude-brand-guardian.json'

describe('brandGuardianOutputSchema', () => {
  it('validates correct structure from fixture', () => {
    const result = brandGuardianOutputSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('validates a minimal valid output', () => {
    const minimal = {
      reviews: [{
        contentItemId: 'item-1',
        qualityScore: 75,
        toneAlignment: 80,
        styleConsistency: 70,
        principleAdherence: 75,
        bannedPhraseViolations: [],
        issues: [],
        suggestions: [],
      }],
      qualityGateResults: [{
        contentItemId: 'item-1',
        qualityScore: 75,
        threshold: 70,
        passed: true,
        blockedReasons: [],
      }],
      overallAssessment: {
        averageScore: 75,
        totalReviewed: 1,
        totalPassed: 1,
        totalBlocked: 0,
      },
      learnedPatterns: [],
    }

    const result = brandGuardianOutputSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('rejects missing reviews array', () => {
    const invalid = {
      qualityGateResults: [{contentItemId: 'a', qualityScore: 70, threshold: 70, passed: true, blockedReasons: []}],
      overallAssessment: {averageScore: 70, totalReviewed: 1, totalPassed: 1, totalBlocked: 0},
      learnedPatterns: [],
    }

    const result = brandGuardianOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty reviews array', () => {
    const invalid = {
      reviews: [],
      qualityGateResults: [{contentItemId: 'a', qualityScore: 70, threshold: 70, passed: true, blockedReasons: []}],
      overallAssessment: {averageScore: 70, totalReviewed: 1, totalPassed: 1, totalBlocked: 0},
      learnedPatterns: [],
    }

    const result = brandGuardianOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects quality score outside 0-100 range (above)', () => {
    const invalid = {
      reviews: [{
        contentItemId: 'item-1',
        qualityScore: 150,
        toneAlignment: 80,
        styleConsistency: 70,
        principleAdherence: 75,
        bannedPhraseViolations: [],
        issues: [],
        suggestions: [],
      }],
      qualityGateResults: [{contentItemId: 'item-1', qualityScore: 150, threshold: 70, passed: true, blockedReasons: []}],
      overallAssessment: {averageScore: 150, totalReviewed: 1, totalPassed: 1, totalBlocked: 0},
      learnedPatterns: [],
    }

    const result = brandGuardianOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects quality score outside 0-100 range (below)', () => {
    const invalid = {
      reviews: [{
        contentItemId: 'item-1',
        qualityScore: -5,
        toneAlignment: 80,
        styleConsistency: 70,
        principleAdherence: 75,
        bannedPhraseViolations: [],
        issues: [],
        suggestions: [],
      }],
      qualityGateResults: [{contentItemId: 'item-1', qualityScore: -5, threshold: 70, passed: false, blockedReasons: ['too low']}],
      overallAssessment: {averageScore: -5, totalReviewed: 1, totalPassed: 0, totalBlocked: 1},
      learnedPatterns: [],
    }

    const result = brandGuardianOutputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('brandGuardianReviewSchema', () => {
  it('validates review with all fields', () => {
    const review = fixture.reviews[0]
    const result = brandGuardianReviewSchema.safeParse(review)
    expect(result.success).toBe(true)
  })

  it('rejects review with empty contentItemId', () => {
    const invalid = {
      contentItemId: '',
      qualityScore: 80,
      toneAlignment: 80,
      styleConsistency: 80,
      principleAdherence: 80,
      bannedPhraseViolations: [],
      issues: [],
      suggestions: [],
    }

    const result = brandGuardianReviewSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates review with issues and suggestions', () => {
    const review = fixture.reviews[1]
    const result = brandGuardianReviewSchema.safeParse(review)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.issues).toHaveLength(3)
      expect(result.data.suggestions).toHaveLength(3)
      expect(result.data.bannedPhraseViolations).toEqual(['guaranteed', 'best in class'])
    }
  })

  it('rejects invalid issue category', () => {
    const invalid = {
      contentItemId: 'item-1',
      qualityScore: 80,
      toneAlignment: 80,
      styleConsistency: 80,
      principleAdherence: 80,
      bannedPhraseViolations: [],
      issues: [{category: 'invalid-category', description: 'test', severity: 'low'}],
      suggestions: [],
    }

    const result = brandGuardianReviewSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid severity', () => {
    const invalid = {
      contentItemId: 'item-1',
      qualityScore: 80,
      toneAlignment: 80,
      styleConsistency: 80,
      principleAdherence: 80,
      bannedPhraseViolations: [],
      issues: [{category: 'tone', description: 'test', severity: 'critical'}],
      suggestions: [],
    }

    const result = brandGuardianReviewSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('qualityGateResultSchema', () => {
  it('validates correct structure', () => {
    const result = qualityGateResultSchema.safeParse(fixture.qualityGateResults[0])
    expect(result.success).toBe(true)
  })

  it('validates blocked result with reasons', () => {
    const result = qualityGateResultSchema.safeParse(fixture.qualityGateResults[1])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(false)
      expect(result.data.blockedReasons).toHaveLength(3)
    }
  })

  it('rejects missing contentItemId', () => {
    const invalid = {
      qualityScore: 70,
      threshold: 70,
      passed: true,
      blockedReasons: [],
    }

    const result = qualityGateResultSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing passed field', () => {
    const invalid = {
      contentItemId: 'item-1',
      qualityScore: 70,
      threshold: 70,
      blockedReasons: [],
    }

    const result = qualityGateResultSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('learnedPatternSchema', () => {
  it('validates a valid pattern', () => {
    const result = learnedPatternSchema.safeParse(fixture.learnedPatterns[0])
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const invalid = {
      pattern: 'test pattern',
      patternType: 'tone-correction',
      confidence: 1.5,
      source: 'content-review',
    }

    const result = learnedPatternSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects confidence < 0', () => {
    const invalid = {
      pattern: 'test pattern',
      patternType: 'tone-correction',
      confidence: -0.1,
      source: 'content-review',
    }

    const result = learnedPatternSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid patternType', () => {
    const invalid = {
      pattern: 'test pattern',
      patternType: 'invalid-type',
      confidence: 0.8,
      source: 'content-review',
    }

    const result = learnedPatternSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('brandGuardianInputsSchema', () => {
  it('validates correct inputs', () => {
    const inputs = {
      contentItems: [{id: 'c-1', platform: 'reddit', content: 'Test content'}],
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear and direct',
        brandPrinciples: ['transparency'],
        bannedPhrases: ['guaranteed'],
        qualityThreshold: 70,
      },
      qualityThreshold: 70,
    }

    const result = brandGuardianInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('defaults qualityThreshold in brandVoiceConfig to 70', () => {
    const inputs = {
      contentItems: [{id: 'c-1', platform: 'reddit', content: 'Test content'}],
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear and direct',
        brandPrinciples: [],
        bannedPhrases: [],
      },
      qualityThreshold: 70,
    }

    const result = brandGuardianInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoiceConfig.qualityThreshold).toBe(70)
    }
  })

  it('rejects empty content items', () => {
    const inputs = {
      contentItems: [],
      brandVoiceConfig: {
        tone: 'pro',
        communicationStyle: 'direct',
        brandPrinciples: [],
        bannedPhrases: [],
      },
      qualityThreshold: 70,
    }

    const result = brandGuardianInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})
