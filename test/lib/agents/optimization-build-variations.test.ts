import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {describe, it, expect} from 'vitest'

import {buildVariationsForPipeline} from '../../../src/lib/agents/optimization.js'
import {contentVariationSchema} from '../../../src/lib/schemas/optimization-schema.js'
import type {AbTestOutput} from '../../../src/lib/schemas/optimization-schema.js'

// --- Load fixture ---

const fixtureOutput: AbTestOutput = JSON.parse(
  readFileSync(join(__dirname, '../../fixtures/responses/claude-ab-test-designer.json'), 'utf-8'),
)

describe('buildVariationsForPipeline', () => {
  it('transforms AbTestOutput into ContentVariation[]', () => {
    const result = buildVariationsForPipeline(fixtureOutput)

    expect(result).toHaveLength(5)
    for (const variation of result) {
      expect(variation).toHaveProperty('variationId')
      expect(variation).toHaveProperty('originalContentItemId')
      expect(variation).toHaveProperty('testId')
      expect(variation).toHaveProperty('variationType')
      expect(variation).toHaveProperty('variationDescription')
      expect(variation).toHaveProperty('content')
    }
  })

  it('preserves originalContentItemId links', () => {
    const result = buildVariationsForPipeline(fixtureOutput)

    for (const variation of result) {
      expect(variation.originalContentItemId).toBe('content-1')
    }
  })

  it('strips changeDetails field (not part of ContentVariation)', () => {
    const result = buildVariationsForPipeline(fixtureOutput)

    for (const variation of result) {
      expect(variation).not.toHaveProperty('changeDetails')
    }
  })

  it('each result item passes contentVariationSchema validation', () => {
    const result = buildVariationsForPipeline(fixtureOutput)

    for (const variation of result) {
      const parsed = contentVariationSchema.safeParse(variation)
      expect(parsed.success).toBe(true)
    }
  })

  it('returns empty array for output with empty variations', () => {
    const emptyOutput: AbTestOutput = {
      ...fixtureOutput,
      variations: [],
    }

    // Note: abTestOutputSchema requires min(1) variations, but
    // buildVariationsForPipeline should handle edge case gracefully
    const result = buildVariationsForPipeline(emptyOutput)
    expect(result).toEqual([])
  })

  it('preserves correct variation types', () => {
    const result = buildVariationsForPipeline(fixtureOutput)

    const types = result.map(v => v.variationType)
    expect(types).toContain('hook')
    expect(types).toContain('caption')
    expect(types).toContain('cta')
  })

  it('preserves variationDescription text', () => {
    const result = buildVariationsForPipeline(fixtureOutput)

    for (const variation of result) {
      expect(variation.variationDescription.length).toBeGreaterThan(0)
      // Find the matching source variation
      const source = fixtureOutput.variations.find(v => v.variationId === variation.variationId)
      expect(source).toBeDefined()
      expect(variation.variationDescription).toBe(source?.variationDescription)
    }
  })
})
