import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import YAML from 'yaml'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {shouldSkipValidation, validateProject} from '../../src/hooks/init.js'
import {createTestDir, removeTestDir} from '../helpers/test-project.js'

describe('init hook', () => {
  describe('shouldSkipValidation', () => {
    it('skips validation for install command', () => {
      expect(shouldSkipValidation('install')).toBe(true)
    })

    it('skips validation for help command', () => {
      expect(shouldSkipValidation('help')).toBe(true)
    })

    it('does not skip validation for run command', () => {
      expect(shouldSkipValidation('run')).toBe(false)
    })

    it('does not skip validation for status command', () => {
      expect(shouldSkipValidation('status')).toBe(false)
    })
  })

  describe('validateProject', () => {
    let testDir: string

    beforeEach(async () => {
      testDir = await createTestDir()
    })

    afterEach(async () => {
      await removeTestDir(testDir)
    })

    it('returns config when .mat/config.yaml exists and is valid', async () => {
      const matDir = join(testDir, '.mat')
      await mkdir(matDir, {recursive: true})
      const config = {
        productName: 'Test',
        platforms: ['reddit'],
        skillLevel: 'intermediate',
        brandVoice: {tone: 'professional', style: 'conversational', audience: 'general'},
        agents: {defaultModel: 'sonnet', budgetLimit: 10},
      }
      await writeFile(join(matDir, 'config.yaml'), YAML.stringify(config), 'utf-8')

      const result = await validateProject(testDir)
      expect(result.productName).toBe('Test')
    })

    it('throws when .mat/ directory does not exist', async () => {
      await expect(validateProject(testDir)).rejects.toThrow('No .mat/ directory found')
    })

    it('throws when config.yaml is missing', async () => {
      await mkdir(join(testDir, '.mat'), {recursive: true})
      await expect(validateProject(testDir)).rejects.toThrow()
    })

    it('throws when config.yaml has invalid schema', async () => {
      const matDir = join(testDir, '.mat')
      await mkdir(matDir, {recursive: true})
      await writeFile(join(matDir, 'config.yaml'), YAML.stringify({invalid: true}), 'utf-8')
      await expect(validateProject(testDir)).rejects.toThrow()
    })
  })
})
