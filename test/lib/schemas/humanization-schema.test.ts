import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {
  aiMarkerRemovalSchema,
  humanizationConfigSchema,
  humanizationOutputSchema,
  humanizationResultSchema,
} from '../../../src/lib/schemas/humanization-schema.js'

const validResult = {
  contentId: 'reddit-wellness-1',
  platform: 'reddit' as const,
  originalText: 'In today\'s digital landscape, meditation has emerged as a groundbreaking solution.',
  humanizedText: 'So I\'ve been meditating for about 3 months now and honestly? Game changer.',
  aiMarkersRemoved: [
    {marker: 'In today\'s digital landscape', location: 'opening sentence', replacement: 'Personal anecdote opener'},
  ],
  techniquesApplied: ['sentence-length-variation', 'banned-phrase-removal'],
  estimatedAiScore: 12,
  brandVoiceConsistency: 85,
  meaningPreserved: true,
}

const validOutput = {
  items: [validResult],
  summary: {
    totalItems: 1,
    averageAiScore: 12,
    averageBrandVoiceScore: 85,
    itemsBelowThreshold: 1,
    itemsAboveThreshold: 0,
  },
}

describe('humanization-schema', () => {
  describe('aiMarkerRemovalSchema', () => {
    it('validates correct marker removal', () => {
      const data = {marker: 'Furthermore', location: 'paragraph 2', replacement: 'Plus'}
      expect(() => aiMarkerRemovalSchema.parse(data)).not.toThrow()
    })
  })

  describe('humanizationResultSchema', () => {
    it('validates correct result with all fields', () => {
      const parsed = humanizationResultSchema.parse(validResult)
      expect(parsed.contentId).toBe('reddit-wellness-1')
      expect(parsed.platform).toBe('reddit')
      expect(parsed.estimatedAiScore).toBe(12)
      expect(parsed.meaningPreserved).toBe(true)
    })

    it('rejects estimatedAiScore > 100', () => {
      expect(() => humanizationResultSchema.parse({...validResult, estimatedAiScore: 101})).toThrow()
    })

    it('rejects estimatedAiScore < 0', () => {
      expect(() => humanizationResultSchema.parse({...validResult, estimatedAiScore: -1})).toThrow()
    })

    it('rejects missing humanizedText', () => {
      const {humanizedText: _, ...noHumanizedText} = validResult
      expect(() => humanizationResultSchema.parse(noHumanizedText)).toThrow()
    })

    it('rejects empty humanizedText', () => {
      expect(() => humanizationResultSchema.parse({...validResult, humanizedText: ''})).toThrow()
    })

    it('rejects empty techniquesApplied array', () => {
      expect(() => humanizationResultSchema.parse({...validResult, techniquesApplied: []})).toThrow()
    })

    it('rejects invalid platform', () => {
      expect(() => humanizationResultSchema.parse({...validResult, platform: 'twitter'})).toThrow()
    })

    it('accepts all valid platforms', () => {
      for (const platform of ['tiktok', 'reddit', 'facebook', 'instagram']) {
        expect(() => humanizationResultSchema.parse({...validResult, platform})).not.toThrow()
      }
    })

    it('rejects brandVoiceConsistency > 100', () => {
      expect(() => humanizationResultSchema.parse({...validResult, brandVoiceConsistency: 101})).toThrow()
    })
  })

  describe('humanizationOutputSchema', () => {
    it('validates correct multi-item output', () => {
      const multiItem = {
        items: [
          validResult,
          {...validResult, contentId: 'tiktok-1', platform: 'tiktok' as const, estimatedAiScore: 8},
        ],
        summary: {
          totalItems: 2,
          averageAiScore: 10,
          averageBrandVoiceScore: 85,
          itemsBelowThreshold: 2,
          itemsAboveThreshold: 0,
        },
      }
      const parsed = humanizationOutputSchema.parse(multiItem)
      expect(parsed.items).toHaveLength(2)
      expect(parsed.summary.totalItems).toBe(2)
    })

    it('rejects empty items array', () => {
      expect(() => humanizationOutputSchema.parse({
        items: [],
        summary: {totalItems: 0, averageAiScore: 0, averageBrandVoiceScore: 0, itemsBelowThreshold: 0, itemsAboveThreshold: 0},
      })).toThrow()
    })

    it('rejects summary with totalItems < 1', () => {
      expect(() => humanizationOutputSchema.parse({
        items: [validResult],
        summary: {totalItems: 0, averageAiScore: 12, averageBrandVoiceScore: 85, itemsBelowThreshold: 1, itemsAboveThreshold: 0},
      })).toThrow()
    })

    it('rejects negative itemsAboveThreshold', () => {
      expect(() => humanizationOutputSchema.parse({
        items: [validResult],
        summary: {totalItems: 1, averageAiScore: 12, averageBrandVoiceScore: 85, itemsBelowThreshold: 1, itemsAboveThreshold: -1},
      })).toThrow()
    })
  })

  describe('humanizationConfigSchema', () => {
    it('validates correct config with defaults', () => {
      const parsed = humanizationConfigSchema.parse({})
      expect(parsed.aiDetectionThreshold).toBe(20)
      expect(parsed.preserveKeywords).toBe(true)
    })

    it('applies default threshold of 20', () => {
      const parsed = humanizationConfigSchema.parse({})
      expect(parsed.aiDetectionThreshold).toBe(20)
    })

    it('accepts custom threshold', () => {
      const parsed = humanizationConfigSchema.parse({aiDetectionThreshold: 15})
      expect(parsed.aiDetectionThreshold).toBe(15)
    })

    it('rejects threshold > 100', () => {
      expect(() => humanizationConfigSchema.parse({aiDetectionThreshold: 101})).toThrow()
    })

    it('rejects threshold < 0', () => {
      expect(() => humanizationConfigSchema.parse({aiDetectionThreshold: -1})).toThrow()
    })

    it('accepts optional enabledPlatforms', () => {
      const parsed = humanizationConfigSchema.parse({enabledPlatforms: ['reddit', 'tiktok']})
      expect(parsed.enabledPlatforms).toEqual(['reddit', 'tiktok'])
    })

    it('accepts optional bannedPhrases', () => {
      const parsed = humanizationConfigSchema.parse({bannedPhrases: ['custom phrase']})
      expect(parsed.bannedPhrases).toEqual(['custom phrase'])
    })

    it('defaults preserveKeywords to true', () => {
      const parsed = humanizationConfigSchema.parse({})
      expect(parsed.preserveKeywords).toBe(true)
    })

    it('accepts preserveKeywords false', () => {
      const parsed = humanizationConfigSchema.parse({preserveKeywords: false})
      expect(parsed.preserveKeywords).toBe(false)
    })
  })

  describe('fixture validation', () => {
    it('humanization-result.json fixture validates against humanizationOutputSchema', () => {
      const fixture = JSON.parse(
        readFileSync(join(__dirname, '../../fixtures/responses/humanization-result.json'), 'utf-8'),
      )
      expect(() => humanizationOutputSchema.parse(fixture)).not.toThrow()
      const parsed = humanizationOutputSchema.parse(fixture)
      expect(parsed.items.length).toBeGreaterThan(0)
      expect(parsed.summary.totalItems).toBe(parsed.items.length)
    })

    it('humanization-content-items.json fixture has valid structure', () => {
      const fixture = JSON.parse(
        readFileSync(join(__dirname, '../../fixtures/inputs/humanization-content-items.json'), 'utf-8'),
      ) as Array<{contentId: string; platform: string; text: string}>
      expect(fixture).toBeInstanceOf(Array)
      expect(fixture.length).toBeGreaterThan(0)
      for (const item of fixture) {
        expect(item.contentId).toBeDefined()
        expect(item.platform).toBeDefined()
        expect(item.text).toBeDefined()
        expect(typeof item.text).toBe('string')
        expect(item.text.length).toBeGreaterThan(0)
      }
    })
  })
})
