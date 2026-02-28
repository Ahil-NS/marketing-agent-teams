import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import YAML from 'yaml'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {scaffoldProject} from '../../../src/lib/setup/scaffolder.js'
import {SetupError} from '../../../src/lib/setup/errors.js'
import type {WizardAnswers} from '../../../src/lib/setup/wizard.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

describe('scaffolder', () => {
  let testDir: string
  const answers: WizardAnswers = {
    productName: 'TestProduct',
    platforms: ['reddit', 'tiktok'],
    skillLevel: 'intermediate',
  }

  beforeEach(async () => {
    testDir = await createTestDir()
  })

  afterEach(async () => {
    await removeTestDir(testDir)
  })

  it('creates .mat/ root directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat'))).toBe(true)
  })

  it('creates state/pipeline-runs/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'state', 'pipeline-runs'))).toBe(true)
  })

  it('creates state/review-queue/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'state', 'review-queue'))).toBe(true)
  })

  it('creates state/retry-queue/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'state', 'retry-queue'))).toBe(true)
  })

  it('creates agents/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'agents'))).toBe(true)
  })

  it('creates content/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'content'))).toBe(true)
  })

  it('creates credentials/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'credentials'))).toBe(true)
  })

  it('creates logs/ directory', async () => {
    await scaffoldProject(testDir, answers)
    expect(existsSync(join(testDir, '.mat', 'logs'))).toBe(true)
  })

  it('creates config.yaml with wizard answers', async () => {
    await scaffoldProject(testDir, answers)
    const configPath = join(testDir, '.mat', 'config.yaml')
    expect(existsSync(configPath)).toBe(true)

    const content = await readFile(configPath, 'utf-8')
    const config = YAML.parse(content)
    expect(config.productName).toBe('TestProduct')
    expect(config.platforms).toEqual(['reddit', 'tiktok'])
    expect(config.skillLevel).toBe('intermediate')
  })

  it('config.yaml includes sensible defaults for brandVoice', async () => {
    await scaffoldProject(testDir, answers)
    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)

    expect(config.brandVoice).toBeDefined()
    expect(config.brandVoice.tone).toBe('professional')
    expect(config.brandVoice.style).toBe('conversational')
    expect(config.brandVoice.audience).toBe('general')
  })

  it('config.yaml includes sensible defaults for agents', async () => {
    await scaffoldProject(testDir, answers)
    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)

    expect(config.agents).toBeDefined()
    expect(config.agents.defaultModel).toBe('sonnet')
    expect(config.agents.budgetLimit).toBe(10)
  })

  it('config.yaml is valid YAML that diffs cleanly (NFR25)', async () => {
    await scaffoldProject(testDir, answers)
    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')

    // Should parse without error
    const parsed = YAML.parse(content)
    expect(parsed).toBeDefined()

    // Should not contain tab characters (YAML best practice for git diffs)
    expect(content).not.toContain('\t')
  })

  it('creates credentials/platforms.json with empty metadata', async () => {
    await scaffoldProject(testDir, answers)
    const credPath = join(testDir, '.mat', 'credentials', 'platforms.json')
    expect(existsSync(credPath)).toBe(true)

    const content = await readFile(credPath, 'utf-8')
    const creds = JSON.parse(content)
    expect(creds).toEqual({platforms: {}})
  })

  it('throws SetupError on directory creation failure', async () => {
    // Use an invalid path to trigger failure
    await expect(scaffoldProject('/nonexistent/path/that/should/fail', answers)).rejects.toThrow(SetupError)
  })
})
