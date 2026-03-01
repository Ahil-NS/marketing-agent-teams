import {describe, it, expect} from 'vitest'

import {
  rejectionPatternSchema,
  rejectionMemorySchema,
} from '../../../src/lib/schemas/rejection-schema.js'

const validPattern = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  contentItemId: 'item-abc-123',
  rejectedAngle: 'meditation benefits for corporate productivity',
  rejectionReason: 'Too generic, already covered this angle',
  agentName: 'trend-scout',
  timestamp: '2026-03-01T14:30:00.000Z',
  keywords: ['meditation', 'benefits', 'corporate', 'productivity'],
  confidence: 1.0,
}

describe('rejectionPatternSchema', () => {
  it('accepts valid rejection pattern with all fields', () => {
    const result = rejectionPatternSchema.safeParse(validPattern)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(validPattern.id)
      expect(result.data.rejectedAngle).toBe(validPattern.rejectedAngle)
      expect(result.data.keywords).toEqual(validPattern.keywords)
      expect(result.data.confidence).toBe(1.0)
    }
  })

  it('rejects missing rejectedAngle (empty string fails .min(1))', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      rejectedAngle: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing rejectionReason (empty string fails .min(1))', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      rejectionReason: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects confidence outside 0-1 range (above 1)', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      confidence: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects confidence outside 0-1 range (below 0)', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      confidence: -0.1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts keywords as empty array (no keywords extracted)', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      keywords: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.keywords).toEqual([])
    }
  })

  it('applies default confidence of 1.0 when omitted', () => {
    const {confidence: _, ...withoutConfidence} = validPattern
    const result = rejectionPatternSchema.safeParse(withoutConfidence)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.confidence).toBe(1.0)
    }
  })

  it('rejects invalid UUID in id field', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime in timestamp', () => {
    const result = rejectionPatternSchema.safeParse({
      ...validPattern,
      timestamp: 'not-a-datetime',
    })
    expect(result.success).toBe(false)
  })
})

describe('rejectionMemorySchema', () => {
  it('accepts valid memory with patterns array', () => {
    const result = rejectionMemorySchema.safeParse({
      patterns: [validPattern],
      lastUpdated: '2026-03-01T14:30:00.000Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.patterns).toHaveLength(1)
      expect(result.data.patterns[0].rejectedAngle).toBe(validPattern.rejectedAngle)
    }
  })

  it('accepts empty patterns array', () => {
    const result = rejectionMemorySchema.safeParse({
      patterns: [],
      lastUpdated: '2026-03-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.patterns).toHaveLength(0)
    }
  })

  it('rejects invalid lastUpdated datetime', () => {
    const result = rejectionMemorySchema.safeParse({
      patterns: [],
      lastUpdated: 'yesterday',
    })
    expect(result.success).toBe(false)
  })
})
