import {describe, expect, it} from 'vitest'

import {
  factualClaimSchema,
  claimVerdictSchema,
  factCheckReportSchema,
} from '../../../src/lib/schemas/fact-check-schema.js'

const validClaim = {
  claimText: '90% of users report improved productivity',
  claimType: 'statistic' as const,
  location: {startIndex: 0, endIndex: 45},
}

const validVerdict = {
  claim: validClaim,
  verdict: 'verified' as const,
  confidence: 85,
  evidence: 'According to the 2025 Productivity Report by Gartner',
  suggestedAlternative: undefined,
  caveat: undefined,
  sources: ['https://gartner.com/report-2025'],
}

const validReport = {
  contentItemId: 'item-001',
  claimsFound: 2,
  verdicts: [validVerdict],
  overallAccuracy: 85,
  recommendation: 'pass' as const,
  summary: 'One claim verified with high confidence.',
}

describe('factualClaimSchema', () => {
  it('accepts a valid claim', () => {
    const result = factualClaimSchema.safeParse(validClaim)
    expect(result.success).toBe(true)
  })

  it('rejects empty claimText', () => {
    const result = factualClaimSchema.safeParse({...validClaim, claimText: ''})
    expect(result.success).toBe(false)
  })

  it('rejects invalid claimType', () => {
    const result = factualClaimSchema.safeParse({...validClaim, claimType: 'opinion'})
    expect(result.success).toBe(false)
  })

  it('accepts all valid claim types', () => {
    const types = ['statistic', 'quote', 'historical', 'scientific', 'comparative', 'general'] as const
    for (const type of types) {
      const result = factualClaimSchema.safeParse({...validClaim, claimType: type})
      expect(result.success).toBe(true)
    }
  })

  it('rejects negative startIndex', () => {
    const result = factualClaimSchema.safeParse({
      ...validClaim,
      location: {startIndex: -1, endIndex: 10},
    })
    expect(result.success).toBe(false)
  })
})

describe('claimVerdictSchema', () => {
  it('accepts a valid verdict with all fields', () => {
    const result = claimVerdictSchema.safeParse(validVerdict)
    expect(result.success).toBe(true)
  })

  it('rejects confidence outside 0-100 range (above)', () => {
    const result = claimVerdictSchema.safeParse({...validVerdict, confidence: 101})
    expect(result.success).toBe(false)
  })

  it('rejects confidence outside 0-100 range (below)', () => {
    const result = claimVerdictSchema.safeParse({...validVerdict, confidence: -1})
    expect(result.success).toBe(false)
  })

  it('accepts verdict without optional suggestedAlternative', () => {
    const {suggestedAlternative: _, ...withoutAlternative} = validVerdict
    const result = claimVerdictSchema.safeParse(withoutAlternative)
    expect(result.success).toBe(true)
  })

  it('accepts verdict without optional caveat', () => {
    const {caveat: _, ...withoutCaveat} = validVerdict
    const result = claimVerdictSchema.safeParse(withoutCaveat)
    expect(result.success).toBe(true)
  })

  it('accepts all verdict types', () => {
    const types = ['verified', 'unverifiable', 'likely-accurate', 'likely-inaccurate', 'false'] as const
    for (const type of types) {
      const result = claimVerdictSchema.safeParse({...validVerdict, verdict: type})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid verdict type', () => {
    const result = claimVerdictSchema.safeParse({...validVerdict, verdict: 'maybe'})
    expect(result.success).toBe(false)
  })
})

describe('factCheckReportSchema', () => {
  it('accepts a valid report with multiple verdicts', () => {
    const multiReport = {
      ...validReport,
      claimsFound: 2,
      verdicts: [
        validVerdict,
        {...validVerdict, claim: {...validClaim, claimText: 'Founded in 1998'}, verdict: 'likely-accurate' as const, confidence: 70},
      ],
    }
    const result = factCheckReportSchema.safeParse(multiReport)
    expect(result.success).toBe(true)
  })

  it('accepts report with zero claims (empty verdicts array, overallAccuracy: 100)', () => {
    const emptyReport = {
      contentItemId: 'item-002',
      claimsFound: 0,
      verdicts: [],
      overallAccuracy: 100,
      recommendation: 'pass' as const,
      summary: 'No factual claims found in content.',
    }
    const result = factCheckReportSchema.safeParse(emptyReport)
    expect(result.success).toBe(true)
  })

  it('rejects invalid recommendation value', () => {
    const result = factCheckReportSchema.safeParse({...validReport, recommendation: 'reject'})
    expect(result.success).toBe(false)
  })

  it('rejects empty contentItemId', () => {
    const result = factCheckReportSchema.safeParse({...validReport, contentItemId: ''})
    expect(result.success).toBe(false)
  })
})
