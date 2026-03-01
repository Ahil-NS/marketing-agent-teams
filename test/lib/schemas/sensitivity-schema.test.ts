import {describe, expect, it} from 'vitest'

import {
  sensitivityFlagSchema,
  sensitivityReportSchema,
} from '../../../src/lib/schemas/sensitivity-schema.js'

const validFlag = {
  flaggedText: 'This product is a lifesaver for stressed moms',
  category: 'gender' as const,
  severity: 'medium' as const,
  explanation: 'Assumes primary caregivers are mothers — consider inclusive phrasing',
  suggestedRevision: 'This product is a lifesaver for stressed parents',
  location: {startIndex: 0, endIndex: 46},
}

const validReport = {
  contentItemId: 'item-001',
  flags: [validFlag],
  overallSeverity: 'medium' as const,
  recommendation: 'pass-with-warnings' as const,
  summary: 'One medium-severity gender sensitivity flag found.',
}

describe('sensitivityFlagSchema', () => {
  it('accepts a valid flag', () => {
    const result = sensitivityFlagSchema.safeParse(validFlag)
    expect(result.success).toBe(true)
  })

  it('rejects empty flaggedText', () => {
    const result = sensitivityFlagSchema.safeParse({...validFlag, flaggedText: ''})
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = sensitivityFlagSchema.safeParse({...validFlag, category: 'unknown'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid severity', () => {
    const result = sensitivityFlagSchema.safeParse({...validFlag, severity: 'extreme'})
    expect(result.success).toBe(false)
  })

  it('accepts flag without optional suggestedRevision', () => {
    const {suggestedRevision: _, ...withoutRevision} = validFlag
    const result = sensitivityFlagSchema.safeParse(withoutRevision)
    expect(result.success).toBe(true)
  })

  it('accepts all valid categories', () => {
    const categories = [
      'cultural', 'political', 'religious', 'gender', 'racial',
      'ableist', 'ageist', 'sexual', 'violence', 'profanity', 'controversial',
    ] as const
    for (const category of categories) {
      const result = sensitivityFlagSchema.safeParse({...validFlag, category})
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid severity levels', () => {
    const levels = ['critical', 'high', 'medium', 'low', 'info'] as const
    for (const severity of levels) {
      const result = sensitivityFlagSchema.safeParse({...validFlag, severity})
      expect(result.success).toBe(true)
    }
  })
})

describe('sensitivityReportSchema', () => {
  it('accepts a valid report with multiple flags', () => {
    const multiReport = {
      ...validReport,
      flags: [
        validFlag,
        {...validFlag, flaggedText: 'Only millennials understand this', category: 'ageist' as const, severity: 'low' as const},
      ],
    }
    const result = sensitivityReportSchema.safeParse(multiReport)
    expect(result.success).toBe(true)
  })

  it('accepts report with empty flags array (content is clean)', () => {
    const cleanReport = {
      contentItemId: 'item-002',
      flags: [],
      overallSeverity: 'clear' as const,
      recommendation: 'pass' as const,
      summary: 'No sensitivity issues found.',
    }
    const result = sensitivityReportSchema.safeParse(cleanReport)
    expect(result.success).toBe(true)
  })

  it('rejects invalid overallSeverity', () => {
    const result = sensitivityReportSchema.safeParse({...validReport, overallSeverity: 'extreme'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid recommendation', () => {
    const result = sensitivityReportSchema.safeParse({...validReport, recommendation: 'reject'})
    expect(result.success).toBe(false)
  })

  it('rejects empty contentItemId', () => {
    const result = sensitivityReportSchema.safeParse({...validReport, contentItemId: ''})
    expect(result.success).toBe(false)
  })
})
