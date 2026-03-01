import {describe, expect, it} from 'vitest'

import {
  complianceViolationTypeSchema,
  complianceViolationSchema,
  complianceRewriteSchema,
  complianceReportSchema,
} from '../../../src/lib/schemas/compliance-schema.js'

describe('complianceViolationTypeSchema', () => {
  const validTypes = [
    'ftc-disclosure',
    'health-claims',
    'platform-policy',
    'copyright',
    'age-restriction',
    'financial-claims',
  ] as const

  for (const type of validTypes) {
    it(`accepts valid violation type: ${type}`, () => {
      const result = complianceViolationTypeSchema.safeParse(type)
      expect(result.success).toBe(true)
    })
  }

  it('rejects invalid violation type', () => {
    const result = complianceViolationTypeSchema.safeParse('spam')
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = complianceViolationTypeSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('rejects number', () => {
    const result = complianceViolationTypeSchema.safeParse(42)
    expect(result.success).toBe(false)
  })
})

describe('complianceViolationSchema', () => {
  const validViolation = {
    id: 'v1',
    type: 'ftc-disclosure',
    severity: 'critical',
    flaggedSection: 'Check out this amazing product!',
    policyReference: 'FTC 16 CFR Part 255',
    platform: 'instagram',
    explanation: 'Sponsored content missing required disclosure',
  }

  it('accepts a well-formed violation with all required fields', () => {
    const result = complianceViolationSchema.safeParse(validViolation)
    expect(result.success).toBe(true)
  })

  it('accepts all severity levels', () => {
    for (const severity of ['critical', 'warning', 'info']) {
      const result = complianceViolationSchema.safeParse({...validViolation, severity})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid severity level', () => {
    const result = complianceViolationSchema.safeParse({...validViolation, severity: 'low'})
    expect(result.success).toBe(false)
  })

  it('rejects violation with missing flaggedSection', () => {
    const {flaggedSection: _, ...incomplete} = validViolation
    const result = complianceViolationSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects violation with empty flaggedSection', () => {
    const result = complianceViolationSchema.safeParse({...validViolation, flaggedSection: ''})
    expect(result.success).toBe(false)
  })

  it('rejects violation with missing id', () => {
    const {id: _, ...incomplete} = validViolation
    const result = complianceViolationSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects violation with empty id', () => {
    const result = complianceViolationSchema.safeParse({...validViolation, id: ''})
    expect(result.success).toBe(false)
  })

  it('rejects violation with missing policyReference', () => {
    const {policyReference: _, ...incomplete} = validViolation
    const result = complianceViolationSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects violation with missing platform', () => {
    const {platform: _, ...incomplete} = validViolation
    const result = complianceViolationSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects violation with missing explanation', () => {
    const {explanation: _, ...incomplete} = validViolation
    const result = complianceViolationSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})

describe('complianceRewriteSchema', () => {
  const validRewrite = {
    violationId: 'v1',
    originalSection: 'Check out this amazing product!',
    rewrittenSection: '#ad Check out this amazing product!',
    preservedKeywords: ['amazing', 'product'],
    preservedCta: true,
    explanation: 'Added required FTC disclosure hashtag',
  }

  it('accepts a well-formed rewrite', () => {
    const result = complianceRewriteSchema.safeParse(validRewrite)
    expect(result.success).toBe(true)
  })

  it('accepts rewrite with preservedCta: true', () => {
    const result = complianceRewriteSchema.safeParse({...validRewrite, preservedCta: true})
    expect(result.success).toBe(true)
  })

  it('accepts rewrite with preservedCta: false', () => {
    const result = complianceRewriteSchema.safeParse({...validRewrite, preservedCta: false})
    expect(result.success).toBe(true)
  })

  it('accepts rewrite with empty preservedKeywords array', () => {
    const result = complianceRewriteSchema.safeParse({...validRewrite, preservedKeywords: []})
    expect(result.success).toBe(true)
  })

  it('rejects rewrite missing violationId', () => {
    const {violationId: _, ...incomplete} = validRewrite
    const result = complianceRewriteSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects rewrite with empty violationId', () => {
    const result = complianceRewriteSchema.safeParse({...validRewrite, violationId: ''})
    expect(result.success).toBe(false)
  })

  it('rejects rewrite missing originalSection', () => {
    const {originalSection: _, ...incomplete} = validRewrite
    const result = complianceRewriteSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects rewrite missing rewrittenSection', () => {
    const {rewrittenSection: _, ...incomplete} = validRewrite
    const result = complianceRewriteSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects rewrite missing explanation', () => {
    const {explanation: _, ...incomplete} = validRewrite
    const result = complianceRewriteSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects rewrite missing preservedCta', () => {
    const {preservedCta: _, ...incomplete} = validRewrite
    const result = complianceRewriteSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})

describe('complianceReportSchema', () => {
  const validViolation = {
    id: 'v1',
    type: 'ftc-disclosure' as const,
    severity: 'critical' as const,
    flaggedSection: 'Check out this amazing product!',
    policyReference: 'FTC 16 CFR Part 255',
    platform: 'instagram',
    explanation: 'Sponsored content missing required disclosure',
  }

  const validRewrite = {
    violationId: 'v1',
    originalSection: 'Check out this amazing product!',
    rewrittenSection: '#ad Check out this amazing product!',
    preservedKeywords: ['amazing', 'product'],
    preservedCta: true,
    explanation: 'Added required FTC disclosure hashtag',
  }

  const validReportClean = {
    contentId: 'content-001',
    platform: 'reddit',
    overallStatus: 'compliant' as const,
    complianceScore: 98,
    violations: [],
    rewrites: [],
    wellnessFlags: [],
    summary: 'Content is fully compliant with all platform policies.',
  }

  const validReportWithViolations = {
    contentId: 'content-002',
    platform: 'instagram',
    overallStatus: 'violations-found' as const,
    complianceScore: 45,
    violations: [validViolation],
    rewrites: [validRewrite],
    wellnessFlags: [],
    summary: 'Found 1 FTC disclosure violation. Compliant rewrite suggested.',
  }

  it('validates a clean compliance report (no violations)', () => {
    const result = complianceReportSchema.safeParse(validReportClean)
    expect(result.success).toBe(true)
  })

  it('validates a report with violations and rewrites', () => {
    const result = complianceReportSchema.safeParse(validReportWithViolations)
    expect(result.success).toBe(true)
  })

  it('validates a report with wellness flags', () => {
    const wellnessViolation = {
      ...validViolation,
      id: 'v2',
      type: 'health-claims' as const,
      flaggedSection: 'This meditation technique cures anxiety',
      policyReference: 'FDA 21 CFR 101.93',
      explanation: 'Unverified therapeutic claim',
    }

    const report = {
      ...validReportWithViolations,
      violations: [validViolation, wellnessViolation],
      wellnessFlags: [wellnessViolation],
    }

    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('accepts overallStatus: compliant', () => {
    const result = complianceReportSchema.safeParse(validReportClean)
    expect(result.success).toBe(true)
  })

  it('accepts overallStatus: violations-found', () => {
    const result = complianceReportSchema.safeParse(validReportWithViolations)
    expect(result.success).toBe(true)
  })

  it('accepts overallStatus: requires-review', () => {
    const report = {...validReportClean, overallStatus: 'requires-review'}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects invalid overallStatus', () => {
    const report = {...validReportClean, overallStatus: 'approved'}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects complianceScore above 100', () => {
    const report = {...validReportClean, complianceScore: 101}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects complianceScore below 0', () => {
    const report = {...validReportClean, complianceScore: -1}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('accepts complianceScore at boundary 0', () => {
    const report = {...validReportClean, complianceScore: 0, overallStatus: 'violations-found'}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('accepts complianceScore at boundary 100', () => {
    const report = {...validReportClean, complianceScore: 100}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects report missing contentId', () => {
    const {contentId: _, ...incomplete} = validReportClean
    const result = complianceReportSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects report with empty contentId', () => {
    const report = {...validReportClean, contentId: ''}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects report missing overallStatus', () => {
    const {overallStatus: _, ...incomplete} = validReportClean
    const result = complianceReportSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects report missing platform', () => {
    const {platform: _, ...incomplete} = validReportClean
    const result = complianceReportSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects report missing summary', () => {
    const {summary: _, ...incomplete} = validReportClean
    const result = complianceReportSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects report with empty summary', () => {
    const report = {...validReportClean, summary: ''}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects report missing violations array', () => {
    const {violations: _, ...incomplete} = validReportClean
    const result = complianceReportSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects report missing rewrites array', () => {
    const {rewrites: _, ...incomplete} = validReportClean
    const result = complianceReportSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('accepts fractional complianceScore', () => {
    const report = {...validReportClean, complianceScore: 72.5}
    const result = complianceReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })
})
