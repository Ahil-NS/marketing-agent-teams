import {describe, it, expect} from 'vitest'

import {buildAttributionEntry, appendToAttributionChain} from '../../../src/lib/agents/attribution.js'
import type {AgentResult} from '../../../src/lib/agents/types.js'
import type {AttributionChain, AttributionEntry} from '../../../src/lib/schemas/attribution-schema.js'

function makeAgentResult(overrides?: Partial<AgentResult>): AgentResult {
  return {
    agentName: 'trend-scout',
    runId: 'run-001',
    status: 'success',
    outputs: {},
    usage: {
      inputTokens: 1500,
      outputTokens: 500,
      cost: 0.0025,
      modelName: 'claude-haiku-4-test',
      provider: 'anthropic',
      timestamp: '2026-03-01T12:00:00.000Z',
    },
    duration: 4500,
    errors: [],
    ...overrides,
  }
}

function makeEntry(agentName: string, stage: string): AttributionEntry {
  return {
    modelName: 'claude-haiku-4-test',
    provider: 'anthropic',
    timestamp: '2026-03-01T12:00:00.000Z',
    inputTokens: 1000,
    outputTokens: 300,
    cost: 0.001,
    agentName,
    stage: stage as AttributionEntry['stage'],
    runId: 'run-001',
  }
}

describe('buildAttributionEntry', () => {
  it('extracts all fields correctly from an AgentResult', () => {
    const agentResult = makeAgentResult()
    const entry = buildAttributionEntry(agentResult, 'research', 'run-42')

    expect(entry.modelName).toBe('claude-haiku-4-test')
    expect(entry.provider).toBe('anthropic')
    expect(entry.timestamp).toBe('2026-03-01T12:00:00.000Z')
    expect(entry.inputTokens).toBe(1500)
    expect(entry.outputTokens).toBe(500)
    expect(entry.cost).toBe(0.0025)
    expect(entry.stage).toBe('research')
    expect(entry.runId).toBe('run-42')
  })

  it('uses agentResult.agentName for the agentName field', () => {
    const agentResult = makeAgentResult({agentName: 'seo-optimizer'})
    const entry = buildAttributionEntry(agentResult, 'optimization', 'run-001')

    expect(entry.agentName).toBe('seo-optimizer')
  })

  it('uses the passed runId, not agentResult.runId', () => {
    const agentResult = makeAgentResult({runId: 'agent-run-id'})
    const entry = buildAttributionEntry(agentResult, 'creation', 'pipeline-run-id')

    expect(entry.runId).toBe('pipeline-run-id')
  })
})

describe('appendToAttributionChain', () => {
  it('returns a new array (does not mutate input)', () => {
    const chain: AttributionChain = Object.freeze([makeEntry('reddit-creator', 'creation')]) as unknown as AttributionChain
    const newEntry = makeEntry('seo-optimizer', 'optimization')

    const result = appendToAttributionChain(chain, newEntry)

    expect(result).not.toBe(chain)
    expect(chain).toHaveLength(1)
    expect(result).toHaveLength(2)
  })

  it('appends entry at the end (chronological order)', () => {
    const chain: AttributionChain = [makeEntry('reddit-creator', 'creation')]
    const newEntry = makeEntry('seo-optimizer', 'optimization')

    const result = appendToAttributionChain(chain, newEntry)

    expect(result[0].agentName).toBe('reddit-creator')
    expect(result[1].agentName).toBe('seo-optimizer')
  })

  it('builds a chain across stages (creation -> optimization -> quality)', () => {
    let chain: AttributionChain = []

    chain = appendToAttributionChain(chain, makeEntry('reddit-creator', 'creation'))
    chain = appendToAttributionChain(chain, makeEntry('seo-optimizer', 'optimization'))
    chain = appendToAttributionChain(chain, makeEntry('brand-guardian', 'quality'))

    expect(chain).toHaveLength(3)
    expect(chain[0].agentName).toBe('reddit-creator')
    expect(chain[0].stage).toBe('creation')
    expect(chain[1].agentName).toBe('seo-optimizer')
    expect(chain[1].stage).toBe('optimization')
    expect(chain[2].agentName).toBe('brand-guardian')
    expect(chain[2].stage).toBe('quality')
  })

  it('works with empty chain', () => {
    const chain: AttributionChain = []
    const entry = makeEntry('trend-scout', 'research')
    const result = appendToAttributionChain(chain, entry)

    expect(result).toHaveLength(1)
    expect(result[0].agentName).toBe('trend-scout')
  })
})
