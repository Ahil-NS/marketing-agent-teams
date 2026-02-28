import {describe, it, expect} from 'vitest'

import {memoryEntrySchema, memoryStateSchema} from '../../../src/lib/schemas/agent-schema.js'

describe('memoryEntrySchema', () => {
  const validEntry = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    runId: 'run-abc123',
    timestamp: '2025-01-15T10:30:00Z',
    type: 'learning' as const,
    content: 'Users respond well to question-based hooks',
    source: 'trend-scout',
    confidence: 0.85,
  }

  it('validates a complete memory entry', () => {
    const result = memoryEntrySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(validEntry.id)
      expect(result.data.type).toBe('learning')
      expect(result.data.confidence).toBe(0.85)
    }
  })

  it('accepts all valid entry types', () => {
    const types = ['learning', 'rejection', 'pattern', 'preference'] as const
    for (const type of types) {
      const result = memoryEntrySchema.safeParse({...validEntry, type})
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid entry type', () => {
    const result = memoryEntrySchema.safeParse({...validEntry, type: 'feedback'})
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(memoryEntrySchema.safeParse({}).success).toBe(false)
    expect(memoryEntrySchema.safeParse({id: '550e8400-e29b-41d4-a716-446655440000'}).success).toBe(false)
    expect(
      memoryEntrySchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        runId: 'run-1',
        timestamp: '2025-01-15T10:30:00Z',
        // missing type, content, source, confidence
      }).success,
    ).toBe(false)
  })

  it('validates confidence as number between 0 and 1', () => {
    expect(memoryEntrySchema.safeParse({...validEntry, confidence: 0}).success).toBe(true)
    expect(memoryEntrySchema.safeParse({...validEntry, confidence: 1}).success).toBe(true)
    expect(memoryEntrySchema.safeParse({...validEntry, confidence: 0.5}).success).toBe(true)
    expect(memoryEntrySchema.safeParse({...validEntry, confidence: -0.1}).success).toBe(false)
    expect(memoryEntrySchema.safeParse({...validEntry, confidence: 1.1}).success).toBe(false)
    expect(memoryEntrySchema.safeParse({...validEntry, confidence: 'high'}).success).toBe(false)
  })

  it('rejects invalid UUID for id', () => {
    const result = memoryEntrySchema.safeParse({...validEntry, id: 'not-a-uuid'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime for timestamp', () => {
    const result = memoryEntrySchema.safeParse({...validEntry, timestamp: 'yesterday'})
    expect(result.success).toBe(false)
  })

  it('rejects empty content', () => {
    const result = memoryEntrySchema.safeParse({...validEntry, content: ''})
    expect(result.success).toBe(false)
  })

  it('rejects empty source', () => {
    const result = memoryEntrySchema.safeParse({...validEntry, source: ''})
    expect(result.success).toBe(false)
  })
})

describe('memoryStateSchema', () => {
  const validEntry = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    runId: 'run-abc123',
    timestamp: '2025-01-15T10:30:00Z',
    type: 'learning' as const,
    content: 'Users respond well to question-based hooks',
    source: 'trend-scout',
    confidence: 0.85,
  }

  const validState = {
    agentName: 'trend-scout',
    lastRunId: 'run-abc123',
    lastRunAt: '2025-01-15T10:30:00Z',
    entries: [validEntry],
    metadata: {},
  }

  it('validates a complete AgentMemoryState', () => {
    const result = memoryStateSchema.safeParse(validState)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agentName).toBe('trend-scout')
      expect(result.data.entries).toHaveLength(1)
    }
  })

  it('accepts empty entries array', () => {
    const result = memoryStateSchema.safeParse({
      ...validState,
      entries: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entries).toHaveLength(0)
    }
  })

  it('accepts null lastRunId and lastRunAt', () => {
    const result = memoryStateSchema.safeParse({
      ...validState,
      lastRunId: null,
      lastRunAt: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts metadata with arbitrary keys', () => {
    const result = memoryStateSchema.safeParse({
      ...validState,
      metadata: {customKey: 'value', nested: {a: 1}},
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(memoryStateSchema.safeParse({}).success).toBe(false)
    expect(memoryStateSchema.safeParse({agentName: 'test'}).success).toBe(false)
  })

  it('rejects empty agentName', () => {
    const result = memoryStateSchema.safeParse({...validState, agentName: ''})
    expect(result.success).toBe(false)
  })

  it('rejects invalid entry in entries array', () => {
    const result = memoryStateSchema.safeParse({
      ...validState,
      entries: [{id: 'not-uuid', type: 'invalid'}],
    })
    expect(result.success).toBe(false)
  })

  it('validates multiple entries', () => {
    const secondEntry = {
      ...validEntry,
      id: '660e8400-e29b-41d4-a716-446655440001',
      type: 'pattern' as const,
      content: 'Short-form video performs best on Tuesdays',
    }
    const result = memoryStateSchema.safeParse({
      ...validState,
      entries: [validEntry, secondEntry],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entries).toHaveLength(2)
    }
  })
})
