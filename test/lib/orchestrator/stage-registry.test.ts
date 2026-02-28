import {describe, expect, it} from 'vitest'

import {getStageAgents, getStageDefinition, getStagesAfter, getStagesFrom} from '../../../src/lib/orchestrator/stage-registry.js'
import {PIPELINE_STAGES, STAGE_AGENT_MAP} from '../../../src/lib/orchestrator/types.js'

describe('stage-registry', () => {
  describe('getStageDefinition()', () => {
    it('returns correct definition for research stage', () => {
      const def = getStageDefinition('research')
      expect(def.name).toBe('research')
      expect(def.agents).toEqual(STAGE_AGENT_MAP.research)
      expect(def.parallel).toBe(false)
    })

    it('returns parallel=true for creation stage', () => {
      const def = getStageDefinition('creation')
      expect(def.name).toBe('creation')
      expect(def.parallel).toBe(true)
    })

    it('returns parallel=true for distribution stage', () => {
      const def = getStageDefinition('distribution')
      expect(def.name).toBe('distribution')
      expect(def.parallel).toBe(true)
    })

    it('returns parallel=false for strategy, optimization, quality, review', () => {
      for (const stage of ['strategy', 'optimization', 'quality', 'review'] as const) {
        const def = getStageDefinition(stage)
        expect(def.parallel).toBe(false)
      }
    })

    it('returns empty agents for review stage', () => {
      const def = getStageDefinition('review')
      expect(def.agents).toEqual([])
    })

    it('throws for unknown stage', () => {
      expect(() => getStageDefinition('unknown' as any)).toThrow('Unknown pipeline stage: unknown')
    })
  })

  describe('getStagesAfter()', () => {
    it('returns all stages after research', () => {
      const stages = getStagesAfter('research')
      expect(stages).toEqual(['strategy', 'creation', 'optimization', 'quality', 'review', 'distribution'])
    })

    it('returns only distribution after review', () => {
      const stages = getStagesAfter('review')
      expect(stages).toEqual(['distribution'])
    })

    it('returns empty array after distribution (last stage)', () => {
      const stages = getStagesAfter('distribution')
      expect(stages).toEqual([])
    })

    it('returns empty array for unknown stage', () => {
      const stages = getStagesAfter('unknown' as any)
      expect(stages).toEqual([])
    })
  })

  describe('getStagesFrom()', () => {
    it('returns all stages from research (inclusive)', () => {
      const stages = getStagesFrom('research')
      expect(stages).toEqual([...PIPELINE_STAGES])
    })

    it('returns distribution only from distribution', () => {
      const stages = getStagesFrom('distribution')
      expect(stages).toEqual(['distribution'])
    })

    it('returns review and distribution from review', () => {
      const stages = getStagesFrom('review')
      expect(stages).toEqual(['review', 'distribution'])
    })
  })

  describe('getStageAgents()', () => {
    it('returns agents for each stage matching STAGE_AGENT_MAP', () => {
      for (const stage of PIPELINE_STAGES) {
        expect(getStageAgents(stage)).toEqual(STAGE_AGENT_MAP[stage])
      }
    })
  })

  describe('PIPELINE_STAGES ordering', () => {
    it('has exactly 7 stages in correct order', () => {
      expect(PIPELINE_STAGES).toHaveLength(7)
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
  })
})
