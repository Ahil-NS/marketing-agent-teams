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
})

describe('schemas/index.ts re-export', () => {
  it('re-exports configSchema from index', async () => {
    const {configSchema: schema} = await import('../../../src/lib/schemas/index.js')
    expect(schema).toBeDefined()
  })
})
