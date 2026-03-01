import {describe, expect, it} from 'vitest'

import {ALL_AGENTS, CLUSTERS, validateAgentName} from '../../../src/lib/config/agent-manager.js'

describe('agent-manager content-humanizer registration', () => {
  it('CLUSTERS.optimization includes content-humanizer', () => {
    expect(CLUSTERS.optimization).toContain('content-humanizer')
  })

  it('optimization cluster has 5 agents', () => {
    expect(CLUSTERS.optimization).toHaveLength(5)
  })

  it('ALL_AGENTS includes content-humanizer', () => {
    expect(ALL_AGENTS).toContain('content-humanizer')
  })

  it('validateAgentName does not throw for content-humanizer', () => {
    expect(() => validateAgentName('content-humanizer')).not.toThrow()
  })

  it('optimization cluster contains all expected agents', () => {
    expect(CLUSTERS.optimization).toEqual(
      expect.arrayContaining([
        'seo-optimizer',
        'ab-test-designer',
        'timing-optimizer',
        'hashtag-strategist',
        'content-humanizer',
      ]),
    )
  })
})
