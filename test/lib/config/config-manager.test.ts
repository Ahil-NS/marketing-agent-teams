import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import YAML from 'yaml'

import {getConfigPath, readConfig, writeConfig} from '../../../src/lib/config/index.js'
import {MATError} from '../../../src/lib/utils/errors.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

describe('config-manager', () => {
  let testDir: string

  const validConfig = {
    productName: 'TestProduct',
    platforms: ['reddit'],
    skillLevel: 'intermediate',
    brandVoice: {
      tone: 'professional',
      communicationStyle: 'clear and direct',
      brandPrinciples: [],
      bannedPhrases: [],
    },
    agents: {
      defaultModel: 'sonnet',
      budgetLimit: 10,
    },
  }

  beforeEach(async () => {
    testDir = await createTestDir()
    await mkdir(join(testDir, '.mat'), {recursive: true})
  })

  afterEach(async () => {
    await removeTestDir(testDir)
  })

  describe('readConfig', () => {
    it('reads and validates a valid config', async () => {
      await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(validConfig), 'utf-8')

      const result = await readConfig(testDir)
      expect(result.validated.productName).toBe('TestProduct')
      expect(result.validated.brandVoice.tone).toBe('professional')
      expect(result.raw).toBeDefined()
    })

    it('applies defaults for omitted optional fields', async () => {
      const minConfig = {
        productName: 'TestProduct',
        platforms: ['reddit'],
        skillLevel: 'intermediate',
      }
      await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(minConfig), 'utf-8')

      const result = await readConfig(testDir)
      expect(result.validated.brandVoice.tone).toBe('professional')
      expect(result.validated.agents.defaultModel).toBe('sonnet')
    })

    it('throws MATError with CONFIG_READ_FAILED when config.yaml missing', async () => {
      await expect(readConfig(testDir)).rejects.toThrow(MATError)
      try {
        await readConfig(testDir)
      } catch (error) {
        expect(error).toBeInstanceOf(MATError)
        expect((error as MATError).code).toBe('CONFIG_READ_FAILED')
      }
    })

    it('throws MATError with CONFIG_VALIDATION_FAILED for invalid config', async () => {
      await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify({invalid: true}), 'utf-8')

      await expect(readConfig(testDir)).rejects.toThrow(MATError)
      try {
        await readConfig(testDir)
      } catch (error) {
        expect(error).toBeInstanceOf(MATError)
        expect((error as MATError).code).toBe('CONFIG_VALIDATION_FAILED')
      }
    })
  })

  describe('writeConfig', () => {
    it('writes valid config to disk', async () => {
      await writeConfig(testDir, validConfig)

      const content = await import('node:fs/promises').then(fs =>
        fs.readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8'),
      )
      const parsed = YAML.parse(content)
      expect(parsed.productName).toBe('TestProduct')
    })

    it('validates config before writing', async () => {
      const invalidConfig = {invalid: true}

      await expect(writeConfig(testDir, invalidConfig)).rejects.toThrow(MATError)
      try {
        await writeConfig(testDir, invalidConfig)
      } catch (error) {
        expect(error).toBeInstanceOf(MATError)
        expect((error as MATError).code).toBe('CONFIG_VALIDATION_FAILED')
      }
    })

    it('throws MATError with CONFIG_WRITE_FAILED for unwritable path', async () => {
      await expect(writeConfig('/nonexistent/path', validConfig)).rejects.toThrow(MATError)
      try {
        await writeConfig('/nonexistent/path', validConfig)
      } catch (error) {
        expect(error).toBeInstanceOf(MATError)
        expect((error as MATError).code).toBe('CONFIG_WRITE_FAILED')
      }
    })
  })

  describe('getConfigPath', () => {
    it('returns path to .mat/config.yaml', () => {
      const result = getConfigPath('/my/project')
      expect(result).toBe(join('/my/project', '.mat', 'config.yaml'))
    })
  })
})
