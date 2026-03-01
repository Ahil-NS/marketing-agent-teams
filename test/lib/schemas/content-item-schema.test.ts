import {describe, it, expect} from 'vitest'

import {contentItemSchema} from '../../../src/lib/schemas/creation-schema.js'
import {contentItemAttributionSchema} from '../../../src/lib/schemas/content-item-schema.js'

describe('contentItemAttributionSchema', () => {
  it('accepts attribution with empty chain', () => {
    const result = contentItemAttributionSchema.safeParse({
      attributionChain: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts attribution with populated chain', () => {
    const result = contentItemAttributionSchema.safeParse({
      attributionChain: [
        {
          modelName: 'claude-haiku-4-test',
          provider: 'anthropic',
          timestamp: '2026-03-01T12:00:00.000Z',
          inputTokens: 1000,
          outputTokens: 300,
          cost: 0.001,
          agentName: 'reddit-creator',
          stage: 'creation',
          runId: 'run-001',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing attributionChain', () => {
    const result = contentItemAttributionSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('contentItemSchema with attribution', () => {
  const baseItem = {
    itemId: 'item-001',
    platform: 'reddit' as const,
    contentType: 'post',
    title: 'Test Title',
    body: 'Test body content',
    metadata: {},
    status: 'draft' as const,
    generatedBy: 'reddit-creator',
    agentName: 'reddit-creator',
    campaignId: 'campaign-001',
    createdAt: '2026-03-01T12:00:00.000Z',
  }

  it('accepts a content item with empty attribution chain', () => {
    const result = contentItemSchema.safeParse({
      ...baseItem,
      attribution: {attributionChain: []},
    })
    expect(result.success).toBe(true)
  })

  it('accepts a content item with multi-entry attribution chain spanning creation, optimization, and quality stages', () => {
    const attribution = {
      attributionChain: [
        {
          modelName: 'claude-haiku-4-test',
          provider: 'anthropic',
          timestamp: '2026-03-01T12:00:00.000Z',
          inputTokens: 1000,
          outputTokens: 300,
          cost: 0.001,
          agentName: 'reddit-creator',
          stage: 'creation',
          runId: 'run-001',
        },
        {
          modelName: 'claude-sonnet-4-test',
          provider: 'anthropic',
          timestamp: '2026-03-01T12:01:00.000Z',
          inputTokens: 2000,
          outputTokens: 600,
          cost: 0.005,
          agentName: 'seo-optimizer',
          stage: 'optimization',
          runId: 'run-001',
        },
        {
          modelName: 'claude-haiku-4-test',
          provider: 'anthropic',
          timestamp: '2026-03-01T12:02:00.000Z',
          inputTokens: 800,
          outputTokens: 200,
          cost: 0.0008,
          agentName: 'brand-guardian',
          stage: 'quality',
          runId: 'run-001',
        },
      ],
    }

    const result = contentItemSchema.safeParse({...baseItem, attribution})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.attribution?.attributionChain).toHaveLength(3)
    }
  })

  it('accepts a content item without attribution field (optional)', () => {
    const result = contentItemSchema.safeParse(baseItem)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.attribution).toBeUndefined()
    }
  })

  it('rejects a content item with invalid attribution (missing chain)', () => {
    const result = contentItemSchema.safeParse({
      ...baseItem,
      attribution: {},
    })
    expect(result.success).toBe(false)
  })
})
