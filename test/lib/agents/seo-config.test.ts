import {describe, it, expect} from 'vitest'

import {getPlatformSeoConfig} from '../../../src/lib/agents/seo-config.js'
import {
  tiktokSeoConfigSchema,
  redditSeoConfigSchema,
  facebookSeoConfigSchema,
  instagramSeoConfigSchema,
} from '../../../src/lib/schemas/seo-schema.js'
import type {TikTokSeoConfig} from '../../../src/lib/schemas/seo-schema.js'
import {MATError} from '../../../src/lib/utils/errors.js'

describe('getPlatformSeoConfig', () => {
  it('returns valid TikTok config with 4 indexable layers', () => {
    const config = getPlatformSeoConfig('tiktok') as TikTokSeoConfig
    expect(config.platform).toBe('tiktok')
    expect(config.indexableLayers).toBeDefined()
    expect(config.indexableLayers.captionText).toBeDefined()
    expect(config.indexableLayers.ocrTextOverlay).toBeDefined()
    expect(config.indexableLayers.audioKeywords).toBeDefined()
    expect(config.indexableLayers.hashtags).toBeDefined()
  })

  it('returns Reddit config with zero hashtag max', () => {
    const config = getPlatformSeoConfig('reddit')
    expect(config.platform).toBe('reddit')
    expect(config.hashtagRange.min).toBe(0)
    expect(config.hashtagRange.max).toBe(0)
  })

  it('returns Instagram config with alt-text 100-125 chars', () => {
    const config = getPlatformSeoConfig('instagram')
    expect(config.platform).toBe('instagram')
    expect(config.altTextRequired).toBe(true)
    expect(config.altTextCharLimit).toBeDefined()
    expect(config.altTextCharLimit!.max).toBeLessThanOrEqual(125)
    expect(config.altTextCharLimit!.optimal).toBeGreaterThanOrEqual(100)
  })

  it('returns Facebook config with 1-2 hashtag range', () => {
    const config = getPlatformSeoConfig('facebook')
    expect(config.platform).toBe('facebook')
    expect(config.hashtagRange.min).toBe(1)
    expect(config.hashtagRange.max).toBe(2)
  })

  it('throws MATError with resolution for unknown platform', () => {
    expect(() => getPlatformSeoConfig('youtube')).toThrow(MATError)
    try {
      getPlatformSeoConfig('youtube')
    } catch (error) {
      const matError = error as MATError
      expect(matError.code).toBe('SEO_CONFIG_NOT_FOUND')
      expect(matError.resolution).toContain('tiktok')
      expect(matError.resolution).toContain('reddit')
      expect(matError.resolution).toContain('facebook')
      expect(matError.resolution).toContain('instagram')
    }
  })

  it('all default configs pass Zod validation', () => {
    expect(() => tiktokSeoConfigSchema.parse(getPlatformSeoConfig('tiktok'))).not.toThrow()
    expect(() => redditSeoConfigSchema.parse(getPlatformSeoConfig('reddit'))).not.toThrow()
    expect(() => facebookSeoConfigSchema.parse(getPlatformSeoConfig('facebook'))).not.toThrow()
    expect(() => instagramSeoConfigSchema.parse(getPlatformSeoConfig('instagram'))).not.toThrow()
  })
})
