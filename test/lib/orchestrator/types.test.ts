import {describe, expect, it} from 'vitest'

describe('orchestrator/types', () => {
  describe('PIPELINE_STAGES', () => {
    it('contains exactly 7 stages in correct order', async () => {
      const {PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
      expect(PIPELINE_STAGES).toEqual([
        'research',
        'strategy',
        'creation',
        'optimization',
        'quality',
        'review',
        'distribution',
      ])
    })

    it('is readonly', async () => {
      const {PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
      expect(Object.isFrozen(PIPELINE_STAGES)).toBe(true)
    })
  })

  describe('STAGE_AGENT_MAP', () => {
    it('maps each pipeline stage to agent names', async () => {
      const {STAGE_AGENT_MAP, PIPELINE_STAGES} = await import('../../../src/lib/orchestrator/types.js')
      for (const stage of PIPELINE_STAGES) {
        expect(STAGE_AGENT_MAP).toHaveProperty(stage)
        expect(Array.isArray(STAGE_AGENT_MAP[stage])).toBe(true)
      }
    })

    it('research stage has 5 agents', async () => {
      const {STAGE_AGENT_MAP} = await import('../../../src/lib/orchestrator/types.js')
      expect(STAGE_AGENT_MAP.research).toEqual(['trend-scout', 'audience-researcher', 'competitor-analyst', 'viral-pattern-decoder', 'platform-algorithm'])
    })

    it('review stage has no agents (human review)', async () => {
      const {STAGE_AGENT_MAP} = await import('../../../src/lib/orchestrator/types.js')
      expect(STAGE_AGENT_MAP.review).toEqual([])
    })

    it('creation stage has platform-specific agents', async () => {
      const {STAGE_AGENT_MAP} = await import('../../../src/lib/orchestrator/types.js')
      expect(STAGE_AGENT_MAP.creation).toContain('reddit-creator')
      expect(STAGE_AGENT_MAP.creation).toContain('tiktok-creator')
    })
  })

  describe('DEFAULT_STAGE_RUNNER_OPTIONS', () => {
    it('has sensible defaults', async () => {
      const {DEFAULT_STAGE_RUNNER_OPTIONS} = await import('../../../src/lib/orchestrator/types.js')
      expect(DEFAULT_STAGE_RUNNER_OPTIONS.concurrencyLimit).toBe(Infinity)
      expect(DEFAULT_STAGE_RUNNER_OPTIONS.agentTimeoutMs).toBe(300_000)
      expect(DEFAULT_STAGE_RUNNER_OPTIONS.continueOnFailure).toBe(true)
    })
  })
})
