import {describe, it, expect} from 'vitest'

import type {OrchestratorEvents} from '../../../src/lib/orchestrator/types.js'

describe('OrchestratorEvents.onViralDetected', () => {
  it('onViralDetected is a valid event handler type', () => {
    // Verify the event type is accepted in the OrchestratorEvents interface
    const events: OrchestratorEvents = {
      onViralDetected: (itemId: string, platform: string) => {
        expect(itemId).toBeDefined()
        expect(platform).toBeDefined()
      },
    }
    events.onViralDetected?.('item-001', 'reddit')
  })

  it('onViralDetected is optional', () => {
    const events: OrchestratorEvents = {}
    expect(events.onViralDetected).toBeUndefined()
  })
})

describe('DERIVATIVE_PIPELINE_STAGES', () => {
  it('defines derivative pipeline stages (skipping research and strategy)', async () => {
    const {DERIVATIVE_PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
    expect(DERIVATIVE_PIPELINE_STAGES).toEqual(['creation', 'optimization', 'quality', 'review'])
  })

  it('does not include research stage', async () => {
    const {DERIVATIVE_PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
    expect(DERIVATIVE_PIPELINE_STAGES).not.toContain('research')
  })

  it('does not include strategy stage', async () => {
    const {DERIVATIVE_PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
    expect(DERIVATIVE_PIPELINE_STAGES).not.toContain('strategy')
  })

  it('ends at review (no distribution for derivatives)', async () => {
    const {DERIVATIVE_PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
    expect(DERIVATIVE_PIPELINE_STAGES).not.toContain('distribution')
    expect(DERIVATIVE_PIPELINE_STAGES[DERIVATIVE_PIPELINE_STAGES.length - 1]).toBe('review')
  })
})
