import {describe, expect, it} from 'vitest'

import {configSchema} from '../../../src/lib/schemas/config-schema.js'

describe('configSchema', () => {
  const validConfig = {
    productName: 'TestProduct',
    platforms: ['reddit', 'tiktok'],
    skillLevel: 'intermediate',
    brandVoice: {
      tone: 'professional',
      style: 'conversational',
      audience: 'general',
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

  it('provides defaults for brandVoice when omitted', () => {
    const {brandVoice: _, ...config} = validConfig
    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandVoice.tone).toBe('professional')
      expect(result.data.brandVoice.style).toBe('conversational')
      expect(result.data.brandVoice.audience).toBe('general')
    }
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

describe('schemas/index.ts re-export', () => {
  it('re-exports configSchema from index', async () => {
    const {configSchema: schema} = await import('../../../src/lib/schemas/index.js')
    expect(schema).toBeDefined()
  })
})
