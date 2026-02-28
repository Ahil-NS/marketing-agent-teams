import {describe, it, expect} from 'vitest'

import {agentDefinitionSchema, trendBriefSchema} from '../../../src/lib/schemas/agent-schema.js'

describe('agentDefinitionSchema', () => {
  it('validates a complete agent definition', () => {
    const valid = {
      name: 'trend-scout',
      description: 'Researches trends',
      cluster: 'intelligence',
      model: 'haiku',
      tools: ['WebSearch', 'WebFetch'],
      trustTier: 'builtin',
    }
    const result = agentDefinitionSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('trend-scout')
      expect(result.data.cluster).toBe('intelligence')
    }
  })

  it('applies defaults for model, tools, and trustTier', () => {
    const minimal = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'creation',
    }
    const result = agentDefinitionSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.model).toBe('haiku')
      expect(result.data.tools).toEqual([])
      expect(result.data.trustTier).toBe('builtin')
    }
  })

  it('rejects empty name', () => {
    const invalid = {
      name: '',
      description: 'test',
      cluster: 'intelligence',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty description', () => {
    const invalid = {
      name: 'test',
      description: '',
      cluster: 'intelligence',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid cluster', () => {
    const invalid = {
      name: 'test',
      description: 'test',
      cluster: 'nonexistent',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts all valid cluster values', () => {
    const clusters = ['intelligence', 'strategy', 'creation', 'optimization', 'quality', 'distribution', 'coordination']
    for (const cluster of clusters) {
      const result = agentDefinitionSchema.safeParse({
        name: 'test',
        description: 'test',
        cluster,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid model', () => {
    const invalid = {
      name: 'test',
      description: 'test',
      cluster: 'intelligence',
      model: 'opus',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid trustTier', () => {
    const invalid = {
      name: 'test',
      description: 'test',
      cluster: 'intelligence',
      trustTier: 'admin',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts optional examples field with valid entries', () => {
    const withExamples = {
      name: 'trend-scout',
      description: 'Researches trends',
      cluster: 'intelligence',
      examples: [
        {
          description: 'SaaS product trend research',
          inputs: {brandName: 'TestBrand', productDomain: 'SaaS'},
        },
      ],
    }
    const result = agentDefinitionSchema.safeParse(withExamples)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.examples).toHaveLength(1)
      expect(result.data.examples![0].description).toBe('SaaS product trend research')
      expect(result.data.examples![0].inputs).toEqual({brandName: 'TestBrand', productDomain: 'SaaS'})
    }
  })

  it('accepts agent definition without examples field', () => {
    const withoutExamples = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'creation',
    }
    const result = agentDefinitionSchema.safeParse(withoutExamples)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.examples).toBeUndefined()
    }
  })

  it('rejects examples with empty description', () => {
    const invalid = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      examples: [
        {description: '', inputs: {key: 'value'}},
      ],
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('applies default permissions when not provided', () => {
    const minimal = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'creation',
    }
    const result = agentDefinitionSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual({
        credentials: [],
        dataScopes: [],
        toolScopes: [],
      })
    }
  })

  it('accepts full permissions object', () => {
    const withPermissions = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {
        credentials: ['reddit-oauth'],
        dataScopes: ['brand-config', 'trend-data'],
        toolScopes: ['WebSearch', 'WebFetch'],
      },
    }
    const result = agentDefinitionSchema.safeParse(withPermissions)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions.credentials).toEqual(['reddit-oauth'])
      expect(result.data.permissions.dataScopes).toContain('brand-config')
      expect(result.data.permissions.toolScopes).toHaveLength(2)
    }
  })

  it('applies defaults for partial permissions object', () => {
    const partial = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {
        credentials: ['my-key'],
      },
    }
    const result = agentDefinitionSchema.safeParse(partial)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions.credentials).toEqual(['my-key'])
      expect(result.data.permissions.dataScopes).toEqual([])
      expect(result.data.permissions.toolScopes).toEqual([])
    }
  })

  it('accepts empty permissions object', () => {
    const empty = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {},
    }
    const result = agentDefinitionSchema.safeParse(empty)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual({
        credentials: [],
        dataScopes: [],
        toolScopes: [],
      })
    }
  })

  it('rejects permissions.credentials as non-array', () => {
    const invalid = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {
        credentials: 'not-an-array',
      },
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('trendBriefSchema', () => {
  const validBrief = {
    trends: [
      {
        name: 'Test Trend',
        description: 'A trending topic',
        relevance: 0.85,
        source: 'https://example.com',
      },
    ],
    viralPatterns: [
      {
        pattern: 'Hook pattern',
        platform: 'tiktok',
        examples: ['Example 1'],
      },
    ],
    opportunities: [
      {
        description: 'Marketing opportunity',
        platform: 'reddit',
        priority: 'high' as const,
      },
    ],
  }

  it('validates a complete trend brief', () => {
    const result = trendBriefSchema.safeParse(validBrief)
    expect(result.success).toBe(true)
  })

  it('accepts brief without optional source field', () => {
    const brief = {
      ...validBrief,
      trends: [{name: 'No Source', description: 'test', relevance: 0.5}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(true)
  })

  it('accepts brief without optional examples field', () => {
    const brief = {
      ...validBrief,
      viralPatterns: [{pattern: 'test', platform: 'reddit'}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(true)
  })

  it('rejects relevance below 0', () => {
    const brief = {
      ...validBrief,
      trends: [{name: 'test', description: 'test', relevance: -0.1}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('rejects relevance above 1', () => {
    const brief = {
      ...validBrief,
      trends: [{name: 'test', description: 'test', relevance: 1.1}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('rejects invalid priority', () => {
    const brief = {
      ...validBrief,
      opportunities: [{description: 'test', platform: 'reddit', priority: 'critical'}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('accepts empty arrays', () => {
    const brief = {
      trends: [],
      viralPatterns: [],
      opportunities: [],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(trendBriefSchema.safeParse({}).success).toBe(false)
    expect(trendBriefSchema.safeParse({trends: []}).success).toBe(false)
    expect(trendBriefSchema.safeParse({trends: [], viralPatterns: []}).success).toBe(false)
  })
})
