import {describe, expect, it} from 'vitest'

import {configSchema} from '../../../src/lib/schemas/config-schema.js'

describe('configSchema', () => {
  const validConfig = {
    productName: 'TestProduct',
    platforms: ['reddit', 'tiktok'],
    skillLevel: 'intermediate',
    brandVoice: {
      tone: 'professional',
      communicationStyle: 'clear and direct',
      brandPrinciples: ['Be helpful'],
      bannedPhrases: ['synergy'],
    },
    agents: {
      defaultModel: 'sonnet',
      budgetLimit: 10,
    },
  }

  it('validates a complete valid config', () => {
    const result = configSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
  })

  it('requires productName', () => {
    const {productName: _, ...config} = validConfig
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('requires platforms array', () => {
    const {platforms: _, ...config} = validConfig
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('requires skillLevel', () => {
    const {skillLevel: _, ...config} = validConfig
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('validates skillLevel is one of beginner/intermediate/advanced', () => {
    const config = {...validConfig, skillLevel: 'invalid'}
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('validates platforms are known values', () => {
    const config = {...validConfig, platforms: ['reddit', 'myspace']}
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects empty platforms array', () => {
    const config = {...validConfig, platforms: []}
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('provides defaults for agents when omitted', () => {
    const {agents: _, ...config} = validConfig
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agents.defaultModel).toBe('sonnet')
      expect(result.data.agents.budgetLimit).toBe(10)
    }
  })

  it('rejects negative budget limit', () => {
    const config = {...validConfig, agents: {...validConfig.agents, budgetLimit: -5}}
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('exports inferred type Config', async () => {
    const {configSchema: schema} = await import('../../../src/lib/schemas/config-schema.js')
    expect(schema).toBeDefined()
  })
})

describe('brandVoiceSchema', () => {
  const baseConfig = {
    productName: 'TestProduct',
    platforms: ['reddit'],
    skillLevel: 'intermediate',
  }

  it('provides defaults for all brandVoice fields when omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.tone).toBe('professional')
      expect(result.data.brandVoice.communicationStyle).toBe('clear and direct')
      expect(result.data.brandVoice.brandPrinciples).toEqual([])
      expect(result.data.brandVoice.bannedPhrases).toEqual([])
    }
  })

  it('accepts valid brandVoice with all fields', () => {
    const config = {
      ...baseConfig,
      brandVoice: {
        tone: 'friendly',
        communicationStyle: 'conversational',
        brandPrinciples: ['Be authentic', 'Stay curious'],
        bannedPhrases: ['synergy', 'leverage'],
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.tone).toBe('friendly')
      expect(result.data.brandVoice.communicationStyle).toBe('conversational')
      expect(result.data.brandVoice.brandPrinciples).toEqual(['Be authentic', 'Stay curious'])
      expect(result.data.brandVoice.bannedPhrases).toEqual(['synergy', 'leverage'])
    }
  })

  it('rejects empty string for tone', () => {
    const config = {
      ...baseConfig,
      brandVoice: {tone: ''},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects empty string for communicationStyle', () => {
    const config = {
      ...baseConfig,
      brandVoice: {communicationStyle: ''},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects empty strings in brandPrinciples array', () => {
    const config = {
      ...baseConfig,
      brandVoice: {brandPrinciples: ['Valid', '']},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects empty strings in bannedPhrases array', () => {
    const config = {
      ...baseConfig,
      brandVoice: {bannedPhrases: ['ok', '']},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts empty arrays for brandPrinciples and bannedPhrases', () => {
    const config = {
      ...baseConfig,
      brandVoice: {
        tone: 'casual',
        communicationStyle: 'minimal',
        brandPrinciples: [],
        bannedPhrases: [],
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('accepts partial brandVoice and fills defaults', () => {
    const config = {
      ...baseConfig,
      brandVoice: {tone: 'enthusiastic'},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.tone).toBe('enthusiastic')
      expect(result.data.brandVoice.communicationStyle).toBe('clear and direct')
      expect(result.data.brandVoice.brandPrinciples).toEqual([])
      expect(result.data.brandVoice.bannedPhrases).toEqual([])
    }
  })

  it('exports BrandVoiceConfig type', async () => {
    const mod = await import('../../../src/lib/schemas/config-schema.js')
    expect(mod.brandVoiceSchema).toBeDefined()
  })

  it('accepts qualityThreshold field', () => {
    const config = {
      ...baseConfig,
      brandVoice: {
        tone: 'professional',
        communicationStyle: 'clear and direct',
        brandPrinciples: [],
        bannedPhrases: [],
        qualityThreshold: 85,
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.qualityThreshold).toBe(85)
    }
  })

  it('defaults qualityThreshold to 70 when omitted', () => {
    const config = {
      ...baseConfig,
      brandVoice: {
        tone: 'friendly',
        communicationStyle: 'conversational',
        brandPrinciples: [],
        bannedPhrases: [],
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.qualityThreshold).toBe(70)
    }
  })

  it('defaults qualityThreshold to 70 when entire brandVoice omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.qualityThreshold).toBe(70)
    }
  })

  it('rejects qualityThreshold below 0', () => {
    const config = {
      ...baseConfig,
      brandVoice: {qualityThreshold: -1},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects qualityThreshold above 100', () => {
    const config = {
      ...baseConfig,
      brandVoice: {qualityThreshold: 101},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts qualityThreshold at boundary 0', () => {
    const config = {
      ...baseConfig,
      brandVoice: {qualityThreshold: 0},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.qualityThreshold).toBe(0)
    }
  })

  it('accepts qualityThreshold at boundary 100', () => {
    const config = {
      ...baseConfig,
      brandVoice: {qualityThreshold: 100},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.qualityThreshold).toBe(100)
    }
  })
})

describe('agentTogglesSchema', () => {
  const baseConfig = {
    productName: 'TestProduct',
    platforms: ['reddit'],
    skillLevel: 'intermediate',
  }

  it('defaults agents.toggles to empty record when omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agents.toggles).toEqual({})
    }
  })

  it('accepts agent toggles with enabled boolean', () => {
    const config = {
      ...baseConfig,
      agents: {
        defaultModel: 'sonnet',
        budgetLimit: 10,
        toggles: {
          'trend-scout': {enabled: false},
          'hook-writer': {enabled: true},
        },
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agents.toggles['trend-scout'].enabled).toBe(false)
      expect(result.data.agents.toggles['hook-writer'].enabled).toBe(true)
    }
  })

  it('defaults enabled to true when not specified in toggle entry', () => {
    const config = {
      ...baseConfig,
      agents: {
        defaultModel: 'sonnet',
        budgetLimit: 10,
        toggles: {
          'trend-scout': {},
        },
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agents.toggles['trend-scout'].enabled).toBe(true)
    }
  })

  it('preserves existing agents fields alongside toggles', () => {
    const config = {
      ...baseConfig,
      agents: {
        defaultModel: 'opus',
        budgetLimit: 25,
        toggles: {'trend-scout': {enabled: false}},
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agents.defaultModel).toBe('opus')
      expect(result.data.agents.budgetLimit).toBe(25)
      expect(result.data.agents.toggles['trend-scout'].enabled).toBe(false)
    }
  })
})

describe('viralThresholdSchema', () => {
  const baseConfig = {
    productName: 'TestProduct',
    platforms: ['reddit'],
    skillLevel: 'intermediate',
  }

  it('defaults viralThreshold.default to 0.75 when omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.default).toBe(0.75)
    }
  })

  it('defaults viralThreshold.enabled to true when omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.enabled).toBe(true)
    }
  })

  it('defaults viralThreshold.perPlatform to empty object when omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.perPlatform).toEqual({})
    }
  })

  it('accepts custom default threshold', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {default: 0.9},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.default).toBe(0.9)
    }
  })

  it('accepts per-platform thresholds', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {
        default: 0.75,
        perPlatform: {
          reddit: 0.8,
          tiktok: 0.6,
        },
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.perPlatform.reddit).toBe(0.8)
      expect(result.data.viralThreshold.perPlatform.tiktok).toBe(0.6)
    }
  })

  it('accepts all four platforms in perPlatform', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {
        perPlatform: {
          reddit: 0.8,
          tiktok: 0.6,
          facebook: 0.7,
          instagram: 0.85,
        },
      },
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.perPlatform.reddit).toBe(0.8)
      expect(result.data.viralThreshold.perPlatform.tiktok).toBe(0.6)
      expect(result.data.viralThreshold.perPlatform.facebook).toBe(0.7)
      expect(result.data.viralThreshold.perPlatform.instagram).toBe(0.85)
    }
  })

  it('rejects default threshold below 0', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {default: -0.1},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects default threshold above 1', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {default: 1.5},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects per-platform threshold below 0', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {perPlatform: {reddit: -0.1}},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects per-platform threshold above 1', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {perPlatform: {tiktok: 2.0}},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('allows disabling viral threshold', () => {
    const config = {
      ...baseConfig,
      viralThreshold: {enabled: false},
    }
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.viralThreshold.enabled).toBe(false)
    }
  })

  it('exports viralThresholdSchema from schemas/index.ts', async () => {
    const mod = await import('../../../src/lib/schemas/index.js')
    expect(mod.viralThresholdSchema).toBeDefined()
  })
})

describe('vertical config field', () => {
  const baseConfig = {
    productName: 'TestProduct',
    platforms: ['reddit'] as const,
    skillLevel: 'intermediate' as const,
  }

  it('accepts optional vertical field', () => {
    const config = {...baseConfig, vertical: 'wellness'}
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vertical).toBe('wellness')
    }
  })

  it('accepts undefined vertical (default behavior)', () => {
    const result = configSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vertical).toBeUndefined()
    }
  })

  it('accepts various vertical names', () => {
    for (const name of ['wellness', 'saas', 'ecommerce', 'fitness', 'fintech']) {
      const config = {...baseConfig, vertical: name}
      const result = configSchema.safeParse(config)
      expect(result.success).toBe(true)
    }
  })

  it('rejects empty string vertical', () => {
    const config = {...baseConfig, vertical: ''}
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})

describe('schemas/index.ts re-export', () => {
  it('re-exports configSchema from index', async () => {
    const {configSchema: schema} = await import('../../../src/lib/schemas/index.js')
    expect(schema).toBeDefined()
  })

  it('re-exports agentTogglesSchema from index', async () => {
    const {agentTogglesSchema} = await import('../../../src/lib/schemas/index.js')
    expect(agentTogglesSchema).toBeDefined()
  })
})
