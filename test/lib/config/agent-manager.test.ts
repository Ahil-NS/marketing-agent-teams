import {describe, expect, it} from 'vitest'

import {ALL_AGENTS, CLUSTERS, listAgentsByCluster, setAgentToggle, validateAgentName} from '../../../src/lib/config/agent-manager.js'
import type {Config} from '../../../src/lib/schemas/index.js'
import {MATError} from '../../../src/lib/utils/errors.js'

function makeConfig(toggles: Record<string, {enabled: boolean}> = {}): Config {
  return {
    productName: 'Test',
    platforms: ['reddit'],
    skillLevel: 'intermediate',
    brandVoice: {tone: 'professional', communicationStyle: 'clear', brandPrinciples: [], bannedPhrases: []},
    agents: {defaultModel: 'sonnet', budgetLimit: 10, toggles},
  }
}

describe('agent-manager', () => {
  describe('CLUSTERS and ALL_AGENTS', () => {
    it('has 7 clusters', () => {
      expect(Object.keys(CLUSTERS)).toHaveLength(7)
    })

    it('has 28 built-in agents', () => {
      expect(ALL_AGENTS).toHaveLength(28)
    })

    it('contains known agents', () => {
      expect(ALL_AGENTS).toContain('trend-scout')
      expect(ALL_AGENTS).toContain('hook-writer')
      expect(ALL_AGENTS).toContain('reddit-publisher')
      expect(ALL_AGENTS).toContain('campaign-coordinator')
      expect(ALL_AGENTS).toContain('viral-pattern-decoder')
      expect(ALL_AGENTS).toContain('platform-algorithm')
    })

    it('intelligence cluster includes viral-pattern-decoder and platform-algorithm', () => {
      expect(CLUSTERS.intelligence).toContain('viral-pattern-decoder')
      expect(CLUSTERS.intelligence).toContain('platform-algorithm')
      expect(CLUSTERS.intelligence).toHaveLength(5)
    })
  })

  describe('listAgentsByCluster', () => {
    it('returns all agents grouped by cluster', () => {
      const result = listAgentsByCluster(makeConfig())
      expect(Object.keys(result)).toHaveLength(7)
      expect(result.intelligence).toHaveLength(5)
      expect(result.creation).toHaveLength(5)
    })

    it('shows all agents as enabled by default', () => {
      const result = listAgentsByCluster(makeConfig())
      for (const agents of Object.values(result)) {
        for (const agent of agents) {
          expect(agent.enabled).toBe(true)
        }
      }
    })

    it('shows disabled agents correctly', () => {
      const result = listAgentsByCluster(makeConfig({
        'trend-scout': {enabled: false},
      }))
      const trendScout = result.intelligence.find(a => a.name === 'trend-scout')
      expect(trendScout?.enabled).toBe(false)
      const audienceResearcher = result.intelligence.find(a => a.name === 'audience-researcher')
      expect(audienceResearcher?.enabled).toBe(true)
    })
  })

  describe('validateAgentName', () => {
    it('does not throw for valid agent name', () => {
      expect(() => validateAgentName('trend-scout')).not.toThrow()
      expect(() => validateAgentName('hook-writer')).not.toThrow()
      expect(() => validateAgentName('viral-pattern-decoder')).not.toThrow()
      expect(() => validateAgentName('platform-algorithm')).not.toThrow()
    })

    it('throws CONFIG_AGENT_NOT_FOUND for unknown agent', () => {
      try {
        validateAgentName('not-an-agent')
        expect.fail('should throw')
      } catch (error) {
        expect(error).toBeInstanceOf(MATError)
        expect((error as MATError).code).toBe('CONFIG_AGENT_NOT_FOUND')
      }
    })

    it('suggests closest match for typos', () => {
      try {
        validateAgentName('trend-scoat')
        expect.fail('should throw')
      } catch (error) {
        expect((error as MATError).resolution).toContain('trend-scout')
      }
    })

    it('does not suggest when name is too different', () => {
      try {
        validateAgentName('zzzznotanagent')
        expect.fail('should throw')
      } catch (error) {
        expect((error as MATError).resolution).not.toContain('Did you mean')
        expect((error as MATError).resolution).toContain('mat config agents')
      }
    })
  })

  describe('setAgentToggle', () => {
    it('sets agent toggle to disabled', () => {
      const raw: Record<string, unknown> = {
        agents: {defaultModel: 'sonnet', budgetLimit: 10, toggles: {}},
      }
      setAgentToggle(raw, 'trend-scout', false)
      const agents = raw.agents as Record<string, unknown>
      const toggles = agents.toggles as Record<string, {enabled: boolean}>
      expect(toggles['trend-scout'].enabled).toBe(false)
    })

    it('sets agent toggle to enabled', () => {
      const raw: Record<string, unknown> = {
        agents: {defaultModel: 'sonnet', budgetLimit: 10, toggles: {'trend-scout': {enabled: false}}},
      }
      setAgentToggle(raw, 'trend-scout', true)
      const agents = raw.agents as Record<string, unknown>
      const toggles = agents.toggles as Record<string, {enabled: boolean}>
      expect(toggles['trend-scout'].enabled).toBe(true)
    })

    it('preserves other toggles', () => {
      const raw: Record<string, unknown> = {
        agents: {defaultModel: 'sonnet', budgetLimit: 10, toggles: {'hook-writer': {enabled: false}}},
      }
      setAgentToggle(raw, 'trend-scout', false)
      const agents = raw.agents as Record<string, unknown>
      const toggles = agents.toggles as Record<string, {enabled: boolean}>
      expect(toggles['hook-writer'].enabled).toBe(false)
      expect(toggles['trend-scout'].enabled).toBe(false)
    })

    it('throws for unknown agent name', () => {
      const raw: Record<string, unknown> = {agents: {toggles: {}}}
      expect(() => setAgentToggle(raw, 'not-real', false)).toThrow(MATError)
    })

    it('creates toggles object if missing', () => {
      const raw: Record<string, unknown> = {agents: {defaultModel: 'sonnet'}}
      setAgentToggle(raw, 'trend-scout', false)
      const agents = raw.agents as Record<string, unknown>
      const toggles = agents.toggles as Record<string, {enabled: boolean}>
      expect(toggles['trend-scout'].enabled).toBe(false)
    })

    it('creates agents object if missing', () => {
      const raw: Record<string, unknown> = {}
      setAgentToggle(raw, 'trend-scout', false)
      const agents = raw.agents as Record<string, unknown>
      const toggles = agents.toggles as Record<string, {enabled: boolean}>
      expect(toggles['trend-scout'].enabled).toBe(false)
    })
  })
})
