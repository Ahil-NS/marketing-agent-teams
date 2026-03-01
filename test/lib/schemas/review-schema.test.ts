import {describe, expect, it} from 'vitest'

import {
  platformSchema,
  reviewStatusSchema,
  contentTypeSchema,
  userFeedbackSchema,
  editHistoryEntrySchema,
  reviewItemSchema,
  reviewFilterSchema,
} from '../../../src/lib/schemas/review-schema.js'

const validReviewItem = {
  id: 'item-2026-03-01-001',
  runId: '550e8400-e29b-41d4-a716-446655440000',
  platform: 'reddit',
  status: 'pending',
  content: {
    title: 'Why meditation apps fail',
    body: 'A deep dive into meditation app UX patterns that lead to churn.',
    hashtags: ['#meditation', '#ux'],
    hooks: ['Stop scrolling and try this'],
    cta: 'Try our guided session',
    platformMeta: {subreddit: 'r/meditation', flair: 'Discussion'},
  },
  qualityScore: 0.92,
  complianceFlags: [],
  contentType: 'standard',
  generatedBy: 'reddit-post-creator',
  generatedAt: '2026-03-01T10:00:00Z',
  scheduledTime: '2026-03-02T14:00:00Z',
  editHistory: [],
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
}

describe('platformSchema', () => {
  for (const platform of ['reddit', 'tiktok', 'facebook', 'instagram'] as const) {
    it(`accepts valid platform: ${platform}`, () => {
      expect(platformSchema.safeParse(platform).success).toBe(true)
    })
  }

  it('rejects invalid platform', () => {
    expect(platformSchema.safeParse('twitter').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(platformSchema.safeParse('').success).toBe(false)
  })

  it('rejects number', () => {
    expect(platformSchema.safeParse(42).success).toBe(false)
  })
})

describe('reviewStatusSchema', () => {
  for (const status of ['pending', 'approved', 'edited', 'rejected'] as const) {
    it(`accepts valid status: ${status}`, () => {
      expect(reviewStatusSchema.safeParse(status).success).toBe(true)
    })
  }

  it('rejects invalid status', () => {
    expect(reviewStatusSchema.safeParse('draft').success).toBe(false)
  })
})

describe('contentTypeSchema', () => {
  for (const type of ['standard', 'trending-derivative', 'retry', 'compliance-flagged'] as const) {
    it(`accepts valid content type: ${type}`, () => {
      expect(contentTypeSchema.safeParse(type).success).toBe(true)
    })
  }

  it('rejects invalid content type', () => {
    expect(contentTypeSchema.safeParse('custom').success).toBe(false)
  })
})

describe('userFeedbackSchema', () => {
  it('accepts valid feedback with all fields', () => {
    const result = userFeedbackSchema.safeParse({
      decision: 'approved',
      reason: 'Good content',
      notes: 'Minor edits applied',
      editedAt: '2026-03-01T12:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts feedback with only required fields', () => {
    const result = userFeedbackSchema.safeParse({decision: 'rejected'})
    expect(result.success).toBe(true)
  })

  it('rejects feedback with invalid decision', () => {
    const result = userFeedbackSchema.safeParse({decision: 'maybe'})
    expect(result.success).toBe(false)
  })

  it('rejects feedback with invalid datetime', () => {
    const result = userFeedbackSchema.safeParse({
      decision: 'edited',
      editedAt: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

describe('editHistoryEntrySchema', () => {
  it('accepts valid edit history entry', () => {
    const result = editHistoryEntrySchema.safeParse({
      timestamp: '2026-03-01T12:00:00Z',
      field: 'content.body',
      originalValue: 'Old text',
      newValue: 'New text',
    })
    expect(result.success).toBe(true)
  })

  it('rejects entry with invalid timestamp', () => {
    const result = editHistoryEntrySchema.safeParse({
      timestamp: 'invalid',
      field: 'content.body',
      originalValue: 'Old',
      newValue: 'New',
    })
    expect(result.success).toBe(false)
  })
})

describe('reviewItemSchema', () => {
  it('accepts a valid complete review item', () => {
    const result = reviewItemSchema.safeParse(validReviewItem)
    expect(result.success).toBe(true)
  })

  it('accepts item without optional fields', () => {
    const minimal = {
      ...validReviewItem,
      content: {
        body: 'Content body',
        platformMeta: {},
      },
      scheduledTime: undefined,
      userFeedback: undefined,
    }
    const result = reviewItemSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('accepts item with userFeedback', () => {
    const withFeedback = {
      ...validReviewItem,
      userFeedback: {
        decision: 'approved' as const,
        reason: 'Looks good',
      },
    }
    const result = reviewItemSchema.safeParse(withFeedback)
    expect(result.success).toBe(true)
  })

  it('accepts item with edit history', () => {
    const withHistory = {
      ...validReviewItem,
      editHistory: [
        {
          timestamp: '2026-03-01T12:00:00Z',
          field: 'content.body',
          originalValue: 'Old',
          newValue: 'New',
        },
      ],
    }
    const result = reviewItemSchema.safeParse(withHistory)
    expect(result.success).toBe(true)
  })

  // Required field validation
  it('rejects missing id', () => {
    const {id: _, ...noId} = validReviewItem
    expect(reviewItemSchema.safeParse(noId).success).toBe(false)
  })

  it('rejects empty id', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, id: ''}).success).toBe(false)
  })

  it('rejects missing runId', () => {
    const {runId: _, ...noRunId} = validReviewItem
    expect(reviewItemSchema.safeParse(noRunId).success).toBe(false)
  })

  it('rejects non-UUID runId', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, runId: 'not-a-uuid'}).success).toBe(false)
  })

  it('rejects missing platform', () => {
    const {platform: _, ...noPlatform} = validReviewItem
    expect(reviewItemSchema.safeParse(noPlatform).success).toBe(false)
  })

  it('rejects invalid platform', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, platform: 'twitter'}).success).toBe(false)
  })

  it('rejects missing status', () => {
    const {status: _, ...noStatus} = validReviewItem
    expect(reviewItemSchema.safeParse(noStatus).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, status: 'draft'}).success).toBe(false)
  })

  it('rejects missing content.body', () => {
    const noBody = {
      ...validReviewItem,
      content: {...validReviewItem.content, body: undefined},
    }
    expect(reviewItemSchema.safeParse(noBody).success).toBe(false)
  })

  it('rejects empty content.body', () => {
    const emptyBody = {
      ...validReviewItem,
      content: {...validReviewItem.content, body: ''},
    }
    expect(reviewItemSchema.safeParse(emptyBody).success).toBe(false)
  })

  it('rejects missing qualityScore', () => {
    const {qualityScore: _, ...noScore} = validReviewItem
    expect(reviewItemSchema.safeParse(noScore).success).toBe(false)
  })

  it('rejects qualityScore below 0', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, qualityScore: -0.1}).success).toBe(false)
  })

  it('rejects qualityScore above 1', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, qualityScore: 1.1}).success).toBe(false)
  })

  it('accepts qualityScore at boundary 0', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, qualityScore: 0}).success).toBe(true)
  })

  it('accepts qualityScore at boundary 1', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, qualityScore: 1}).success).toBe(true)
  })

  it('rejects missing contentType', () => {
    const {contentType: _, ...noType} = validReviewItem
    expect(reviewItemSchema.safeParse(noType).success).toBe(false)
  })

  it('rejects invalid contentType', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, contentType: 'custom'}).success).toBe(false)
  })

  it('rejects missing generatedBy', () => {
    const {generatedBy: _, ...noGen} = validReviewItem
    expect(reviewItemSchema.safeParse(noGen).success).toBe(false)
  })

  it('rejects empty generatedBy', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, generatedBy: ''}).success).toBe(false)
  })

  it('rejects invalid generatedAt datetime', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, generatedAt: 'bad-date'}).success).toBe(false)
  })

  it('rejects invalid scheduledTime datetime', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, scheduledTime: 'bad-date'}).success).toBe(false)
  })

  it('rejects invalid createdAt datetime', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, createdAt: 'not-iso'}).success).toBe(false)
  })

  it('rejects invalid updatedAt datetime', () => {
    expect(reviewItemSchema.safeParse({...validReviewItem, updatedAt: 'not-iso'}).success).toBe(false)
  })
})

describe('reviewFilterSchema', () => {
  it('accepts empty filter (no constraints)', () => {
    expect(reviewFilterSchema.safeParse({}).success).toBe(true)
  })

  it('accepts filter with all fields', () => {
    const result = reviewFilterSchema.safeParse({
      platform: 'reddit',
      status: 'pending',
      contentType: 'standard',
      runId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts filter with single field', () => {
    expect(reviewFilterSchema.safeParse({platform: 'tiktok'}).success).toBe(true)
  })

  it('rejects filter with invalid platform', () => {
    expect(reviewFilterSchema.safeParse({platform: 'twitter'}).success).toBe(false)
  })

  it('rejects filter with invalid status', () => {
    expect(reviewFilterSchema.safeParse({status: 'draft'}).success).toBe(false)
  })

  it('rejects filter with invalid contentType', () => {
    expect(reviewFilterSchema.safeParse({contentType: 'custom'}).success).toBe(false)
  })

  it('accepts qualityAbove within 0-1 range', () => {
    expect(reviewFilterSchema.safeParse({qualityAbove: 0.85}).success).toBe(true)
  })

  it('accepts qualityAbove at boundary values', () => {
    expect(reviewFilterSchema.safeParse({qualityAbove: 0}).success).toBe(true)
    expect(reviewFilterSchema.safeParse({qualityAbove: 1}).success).toBe(true)
  })

  it('rejects qualityAbove below 0', () => {
    expect(reviewFilterSchema.safeParse({qualityAbove: -0.1}).success).toBe(false)
  })

  it('rejects qualityAbove above 1', () => {
    expect(reviewFilterSchema.safeParse({qualityAbove: 1.1}).success).toBe(false)
  })

  it('accepts filter with qualityAbove and other fields', () => {
    const result = reviewFilterSchema.safeParse({
      platform: 'reddit',
      qualityAbove: 0.90,
      contentType: 'standard',
    })
    expect(result.success).toBe(true)
  })
})
