import {describe, it, expect} from 'vitest'

import {
  abTestOutputSchema,
  abTestInputsSchema,
  contentVariationSchema,
  variationTypeSchema,
} from '../../../src/lib/schemas/optimization-schema.js'

// --- Valid test data ---

const validTestPlan = {
  testId: 'test-1',
  originalContentItemId: 'content-1',
  hypothesis: 'A question hook increases engagement by 15%',
  variableUnderTest: 'hook' as const,
  successMetric: 'click-through rate',
}

const validVariation = {
  variationId: 'var-1',
  testId: 'test-1',
  originalContentItemId: 'content-1',
  variationType: 'hook' as const,
  variationDescription: 'Changed opening to curiosity question',
  content: 'Did you know that 90% of...',
  changeDetails: 'Replaced statement hook with question hook',
}

const validAbTestOutput = {
  testPlans: [validTestPlan],
  variations: [validVariation],
  recommendations: {
    primaryTestId: 'test-1',
    rationale: 'Hook variations show highest ROI for engagement',
    expectedImpact: '10-20% engagement increase',
    testDuration: '7 days',
  },
  summary: {
    totalVariations: 1,
    variationsByType: {hook: 1},
    contentItemsCovered: 1,
  },
}

const validAbTestInputs = {
  contentItems: [{id: 'content-1', platform: 'reddit', content: 'Test content'}],
  brandVoiceTone: 'professional',
  brandVoiceStyle: 'clear and direct',
}

const validContentVariation = {
  variationId: 'var-1',
  originalContentItemId: 'content-1',
  testId: 'test-1',
  variationType: 'hook' as const,
  variationDescription: 'Changed opening to curiosity question',
  content: 'Did you know that 90% of...',
}

// --- variationTypeSchema tests ---

describe('variationTypeSchema', () => {
  it('accepts all valid variation types', () => {
    for (const type of ['hook', 'caption', 'hashtag', 'format', 'cta']) {
      const result = variationTypeSchema.safeParse(type)
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid variation type', () => {
    const result = variationTypeSchema.safeParse('invalid-type')
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = variationTypeSchema.safeParse('')
    expect(result.success).toBe(false)
  })
})

// --- abTestOutputSchema tests ---

describe('abTestOutputSchema', () => {
  it('validates correct structure', () => {
    const result = abTestOutputSchema.safeParse(validAbTestOutput)
    expect(result.success).toBe(true)
  })

  it('validates structure with multiple test plans and variations', () => {
    const multiOutput = {
      ...validAbTestOutput,
      testPlans: [
        validTestPlan,
        {...validTestPlan, testId: 'test-2', variableUnderTest: 'caption' as const},
      ],
      variations: [
        validVariation,
        {...validVariation, variationId: 'var-2', variationType: 'caption' as const, testId: 'test-2'},
        {...validVariation, variationId: 'var-3', variationType: 'caption' as const, testId: 'test-2'},
      ],
      summary: {totalVariations: 3, variationsByType: {hook: 1, caption: 2}, contentItemsCovered: 1},
    }
    const result = abTestOutputSchema.safeParse(multiOutput)
    expect(result.success).toBe(true)
  })

  it('rejects missing testPlans array', () => {
    const {testPlans: _, ...noTestPlans} = validAbTestOutput
    const result = abTestOutputSchema.safeParse(noTestPlans)
    expect(result.success).toBe(false)
  })

  it('rejects empty testPlans array', () => {
    const result = abTestOutputSchema.safeParse({...validAbTestOutput, testPlans: []})
    expect(result.success).toBe(false)
  })

  it('rejects missing variations array', () => {
    const {variations: _, ...noVariations} = validAbTestOutput
    const result = abTestOutputSchema.safeParse(noVariations)
    expect(result.success).toBe(false)
  })

  it('rejects empty variations array', () => {
    const result = abTestOutputSchema.safeParse({...validAbTestOutput, variations: []})
    expect(result.success).toBe(false)
  })

  it('rejects missing recommendations', () => {
    const {recommendations: _, ...noRecs} = validAbTestOutput
    const result = abTestOutputSchema.safeParse(noRecs)
    expect(result.success).toBe(false)
  })

  it('rejects missing summary', () => {
    const {summary: _, ...noSummary} = validAbTestOutput
    const result = abTestOutputSchema.safeParse(noSummary)
    expect(result.success).toBe(false)
  })

  it('rejects test plan with empty testId', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      testPlans: [{...validTestPlan, testId: ''}],
    })
    expect(result.success).toBe(false)
  })

  it('rejects test plan with invalid variableUnderTest', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      testPlans: [{...validTestPlan, variableUnderTest: 'invalid'}],
    })
    expect(result.success).toBe(false)
  })

  it('rejects variation with empty variationId', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      variations: [{...validVariation, variationId: ''}],
    })
    expect(result.success).toBe(false)
  })

  it('rejects variation with invalid variationType', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      variations: [{...validVariation, variationType: 'bogus'}],
    })
    expect(result.success).toBe(false)
  })

  it('rejects summary with negative totalVariations', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      summary: {...validAbTestOutput.summary, totalVariations: -1},
    })
    expect(result.success).toBe(false)
  })

  it('rejects summary with zero contentItemsCovered', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      summary: {...validAbTestOutput.summary, contentItemsCovered: 0},
    })
    expect(result.success).toBe(false)
  })

  it('rejects summary with zero totalVariations', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      summary: {...validAbTestOutput.summary, totalVariations: 0},
    })
    expect(result.success).toBe(false)
  })

  it('strips unknown keys from variationsByType', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      summary: {...validAbTestOutput.summary, variationsByType: {hook: 1, bogus: 5}},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.summary.variationsByType).not.toHaveProperty('bogus')
      expect(result.data.summary.variationsByType.hook).toBe(1)
    }
  })

  it('accepts variationsByType with only a subset of variation types', () => {
    const result = abTestOutputSchema.safeParse({
      ...validAbTestOutput,
      summary: {...validAbTestOutput.summary, variationsByType: {caption: 2}},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.summary.variationsByType.caption).toBe(2)
      expect(result.data.summary.variationsByType.hook).toBeUndefined()
    }
  })
})

// --- abTestInputsSchema tests ---

describe('abTestInputsSchema', () => {
  it('validates correct inputs', () => {
    const result = abTestInputsSchema.safeParse(validAbTestInputs)
    expect(result.success).toBe(true)
  })

  it('rejects empty contentItems array', () => {
    const result = abTestInputsSchema.safeParse({...validAbTestInputs, contentItems: []})
    expect(result.success).toBe(false)
  })

  it('rejects missing brandVoiceTone', () => {
    const {brandVoiceTone: _, ...noTone} = validAbTestInputs
    const result = abTestInputsSchema.safeParse(noTone)
    expect(result.success).toBe(false)
  })

  it('rejects missing brandVoiceStyle', () => {
    const {brandVoiceStyle: _, ...noStyle} = validAbTestInputs
    const result = abTestInputsSchema.safeParse(noStyle)
    expect(result.success).toBe(false)
  })

  it('rejects content item with empty id', () => {
    const result = abTestInputsSchema.safeParse({
      ...validAbTestInputs,
      contentItems: [{id: '', platform: 'reddit', content: 'test'}],
    })
    expect(result.success).toBe(false)
  })
})

// --- contentVariationSchema tests ---

describe('contentVariationSchema', () => {
  it('validates correct structure', () => {
    const result = contentVariationSchema.safeParse(validContentVariation)
    expect(result.success).toBe(true)
  })

  it('rejects missing originalContentItemId', () => {
    const {originalContentItemId: _, ...noOriginal} = validContentVariation
    const result = contentVariationSchema.safeParse(noOriginal)
    expect(result.success).toBe(false)
  })

  it('rejects empty originalContentItemId', () => {
    const result = contentVariationSchema.safeParse({...validContentVariation, originalContentItemId: ''})
    expect(result.success).toBe(false)
  })

  it('rejects invalid variationType', () => {
    const result = contentVariationSchema.safeParse({...validContentVariation, variationType: 'bogus'})
    expect(result.success).toBe(false)
  })

  it('rejects missing content', () => {
    const {content: _, ...noContent} = validContentVariation
    const result = contentVariationSchema.safeParse(noContent)
    expect(result.success).toBe(false)
  })

  it('rejects missing variationDescription', () => {
    const {variationDescription: _, ...noDesc} = validContentVariation
    const result = contentVariationSchema.safeParse(noDesc)
    expect(result.success).toBe(false)
  })

  it('rejects missing testId', () => {
    const {testId: _, ...noTestId} = validContentVariation
    const result = contentVariationSchema.safeParse(noTestId)
    expect(result.success).toBe(false)
  })
})
