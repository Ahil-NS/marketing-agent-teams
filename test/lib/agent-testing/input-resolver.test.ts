import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

import {TestInputError} from '../../../src/lib/agent-testing/errors.js'
import {resolveTestInputs} from '../../../src/lib/agent-testing/input-resolver.js'
import type {SkillDefinition} from '../../../src/lib/agents/types.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

const mockReadFile = vi.mocked(readFile)

function createSkillDef(overrides?: Partial<SkillDefinition>): SkillDefinition {
  return {
    name: 'test-agent',
    description: 'A test agent',
    cluster: 'intelligence',
    model: 'haiku',
    tools: ['WebSearch'],
    trustTier: 'builtin',
    permissions: {credentials: [], dataScopes: [], toolScopes: []},
    systemPrompt: 'You are a test agent.',
    knowledgeContext: '',
    templates: {},
    ...overrides,
  }
}

describe('resolveTestInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Priority 1: --input file', () => {
    it('should load and parse a valid JSON input file', async () => {
      const inputData = {brandName: 'TestBrand', productDomain: 'SaaS'}
      mockReadFile.mockResolvedValue(JSON.stringify(inputData))

      const result = await resolveTestInputs('test-agent', createSkillDef(), './test-inputs.json')

      expect(result).toEqual(inputData)
      expect(mockReadFile).toHaveBeenCalledWith(
        resolve(process.cwd(), './test-inputs.json'),
        'utf-8',
      )
    })

    it('should throw TestInputError when file cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'))

      await expect(
        resolveTestInputs('test-agent', createSkillDef(), './missing.json'),
      ).rejects.toThrow(TestInputError)

      await expect(
        resolveTestInputs('test-agent', createSkillDef(), './missing.json'),
      ).rejects.toMatchObject({
        code: 'TEST_INPUT_INVALID',
      })
    })

    it('should throw TestInputError when file contains invalid JSON', async () => {
      mockReadFile.mockResolvedValue('not valid json {{{')

      await expect(
        resolveTestInputs('test-agent', createSkillDef(), './bad.json'),
      ).rejects.toThrow(TestInputError)
    })

    it('should throw TestInputError when file content is not an object', async () => {
      mockReadFile.mockResolvedValue('"just a string"')

      await expect(
        resolveTestInputs('test-agent', createSkillDef(), './string.json'),
      ).rejects.toThrow(TestInputError)
    })
  })

  describe('Priority 2: SKILL.md examples', () => {
    it('should use the first example from SKILL.md when no --input', async () => {
      const skillDef = createSkillDef({
        examples: [
          {description: 'SaaS test', inputs: {brandName: 'ExampleBrand', productDomain: 'SaaS'}},
          {description: 'Ecommerce test', inputs: {brandName: 'ShopBrand'}},
        ],
      })

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toEqual({brandName: 'ExampleBrand', productDomain: 'SaaS'})
    })

    it('should skip examples if array is empty', async () => {
      const skillDef = createSkillDef({
        cluster: 'intelligence',
        examples: [],
      })

      const result = await resolveTestInputs('test-agent', skillDef)

      // Falls through to cluster defaults
      expect(result).toHaveProperty('brandName', 'TestBrand')
    })
  })

  describe('Priority 3: Cluster defaults', () => {
    it('should use cluster defaults for intelligence cluster', async () => {
      const skillDef = createSkillDef({cluster: 'intelligence'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toEqual({
        audienceType: 'developers',
        brandName: 'TestBrand',
        platforms: ['reddit', 'tiktok'],
        productDomain: 'SaaS',
      })
    })

    it('should use cluster defaults for creation cluster', async () => {
      const skillDef = createSkillDef({cluster: 'creation'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toHaveProperty('topic', 'AI productivity tools')
    })

    it('should use cluster defaults for strategy cluster', async () => {
      const skillDef = createSkillDef({cluster: 'strategy'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toHaveProperty('goals')
    })

    it('should use cluster defaults for optimization cluster', async () => {
      const skillDef = createSkillDef({cluster: 'optimization'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toHaveProperty('content')
    })

    it('should use cluster defaults for quality cluster', async () => {
      const skillDef = createSkillDef({cluster: 'quality'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toHaveProperty('brandVoice', 'professional')
    })

    it('should use cluster defaults for distribution cluster', async () => {
      const skillDef = createSkillDef({cluster: 'distribution'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toHaveProperty('dryRun', true)
    })

    it('should use cluster defaults for coordination cluster', async () => {
      const skillDef = createSkillDef({cluster: 'coordination'})

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toHaveProperty('campaignId', 'test-campaign-001')
    })
  })

  describe('Priority order', () => {
    it('should prefer --input over SKILL.md examples', async () => {
      const inputData = {fromFile: true}
      mockReadFile.mockResolvedValue(JSON.stringify(inputData))

      const skillDef = createSkillDef({
        examples: [{description: 'Example', inputs: {fromExample: true}}],
      })

      const result = await resolveTestInputs('test-agent', skillDef, './input.json')

      expect(result).toEqual({fromFile: true})
    })

    it('should prefer SKILL.md examples over cluster defaults', async () => {
      const skillDef = createSkillDef({
        cluster: 'intelligence',
        examples: [{description: 'Custom', inputs: {custom: 'value'}}],
      })

      const result = await resolveTestInputs('test-agent', skillDef)

      expect(result).toEqual({custom: 'value'})
    })
  })

  describe('No inputs available', () => {
    it('should throw TestInputError when no inputs are available for unknown cluster', async () => {
      const skillDef = createSkillDef({cluster: 'unknown-cluster' as any})

      await expect(
        resolveTestInputs('test-agent', skillDef),
      ).rejects.toThrow(TestInputError)

      await expect(
        resolveTestInputs('test-agent', skillDef),
      ).rejects.toMatchObject({
        code: 'TEST_INPUT_INVALID',
      })
    })
  })
})
