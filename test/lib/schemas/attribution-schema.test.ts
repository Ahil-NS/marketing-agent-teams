import {describe, it, expect} from 'vitest'

import {
  modelAttributionSchema,
  attributionEntrySchema,
  attributionChainSchema,
} from '../../../src/lib/schemas/attribution-schema.js'

describe('modelAttributionSchema', () => {
  const validAttribution = {
    modelName: 'claude-haiku-4-2025-04-14',
    provider: 'anthropic',
    timestamp: '2026-03-01T12:00:00.000Z',
    inputTokens: 1500,
    outputTokens: 500,
    cost: 0.0025,
  }

  it('accepts valid attribution object', () => {
    const result = modelAttributionSchema.safeParse(validAttribution)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.modelName).toBe('claude-haiku-4-2025-04-14')
      expect(result.data.provider).toBe('anthropic')
      expect(result.data.cost).toBe(0.0025)
    }
  })

  it('rejects missing modelName (empty string fails .min(1))', () => {
    const result = modelAttributionSchema.safeParse({
      ...validAttribution,
      modelName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative inputTokens', () => {
    const result = modelAttributionSchema.safeParse({
      ...validAttribution,
      inputTokens: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-datetime timestamp', () => {
    const result = modelAttributionSchema.safeParse({
      ...validAttribution,
      timestamp: 'not-a-datetime',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative cost', () => {
    const result = modelAttributionSchema.safeParse({
      ...validAttribution,
      cost: -0.01,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer inputTokens', () => {
    const result = modelAttributionSchema.safeParse({
      ...validAttribution,
      inputTokens: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('attributionEntrySchema', () => {
  const validEntry = {
    modelName: 'claude-haiku-4-test',
    provider: 'anthropic',
    timestamp: '2026-03-01T12:00:00.000Z',
    inputTokens: 1500,
    outputTokens: 500,
    cost: 0.0025,
    agentName: 'trend-scout',
    stage: 'research',
    runId: 'run-001',
  }

  it('accepts entry with valid stage from pipelineStageSchema', () => {
    const result = attributionEntrySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agentName).toBe('trend-scout')
      expect(result.data.stage).toBe('research')
      expect(result.data.runId).toBe('run-001')
    }
  })

  it('rejects invalid stage value', () => {
    const result = attributionEntrySchema.safeParse({
      ...validEntry,
      stage: 'unknown-stage',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty agentName', () => {
    const result = attributionEntrySchema.safeParse({
      ...validEntry,
      agentName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty runId', () => {
    const result = attributionEntrySchema.safeParse({
      ...validEntry,
      runId: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid pipeline stages', () => {
    const stages = ['research', 'strategy', 'creation', 'optimization', 'quality', 'review', 'distribution']
    for (const stage of stages) {
      const result = attributionEntrySchema.safeParse({...validEntry, stage})
      expect(result.success).toBe(true)
    }
  })
})

describe('attributionChainSchema', () => {
  const makeEntry = (agentName: string, stage: string) => ({
    modelName: 'claude-haiku-4-test',
    provider: 'anthropic',
    timestamp: '2026-03-01T12:00:00.000Z',
    inputTokens: 1000,
    outputTokens: 300,
    cost: 0.001,
    agentName,
    stage,
    runId: 'run-001',
  })

  it('accepts empty array (no attributions yet)', () => {
    const result = attributionChainSchema.safeParse([])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([])
    }
  })

  it('accepts multi-entry array with different agents and stages', () => {
    const chain = [
      makeEntry('reddit-creator', 'creation'),
      makeEntry('seo-optimizer', 'optimization'),
      makeEntry('brand-guardian', 'quality'),
    ]
    const result = attributionChainSchema.safeParse(chain)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(3)
      expect(result.data[0].agentName).toBe('reddit-creator')
      expect(result.data[1].stage).toBe('optimization')
      expect(result.data[2].agentName).toBe('brand-guardian')
    }
  })

  it('rejects chain with invalid entry', () => {
    const chain = [
      makeEntry('reddit-creator', 'creation'),
      {...makeEntry('seo-optimizer', 'optimization'), modelName: ''}, // invalid
    ]
    const result = attributionChainSchema.safeParse(chain)
    expect(result.success).toBe(false)
  })
})
