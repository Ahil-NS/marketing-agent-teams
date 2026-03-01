import {mkdtemp, writeFile, rm, mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {getHumanizationConfig} from '../../../src/lib/agents/humanization-config.js'
import {MATError} from '../../../src/lib/utils/errors.js'

describe('getHumanizationConfig', () => {
  let matDir: string

  beforeEach(async () => {
    matDir = await mkdtemp(join(tmpdir(), 'mat-humanization-test-'))
  })

  afterEach(async () => {
    await rm(matDir, {recursive: true, force: true})
  })

  it('returns defaults when no config file exists', async () => {
    const config = await getHumanizationConfig(matDir)
    expect(config.aiDetectionThreshold).toBe(20)
    expect(config.preserveKeywords).toBe(true)
  })

  it('default aiDetectionThreshold is 20', async () => {
    const config = await getHumanizationConfig(matDir)
    expect(config.aiDetectionThreshold).toBe(20)
  })

  it('reads custom threshold from config', async () => {
    await writeFile(
      join(matDir, 'config.yaml'),
      'optimization:\n  humanization:\n    aiDetectionThreshold: 15\n',
    )
    const config = await getHumanizationConfig(matDir)
    expect(config.aiDetectionThreshold).toBe(15)
  })

  it('reads custom banned phrases from config', async () => {
    await writeFile(
      join(matDir, 'config.yaml'),
      'optimization:\n  humanization:\n    bannedPhrases:\n      - "custom banned"\n      - "another one"\n',
    )
    const config = await getHumanizationConfig(matDir)
    expect(config.bannedPhrases).toEqual(['custom banned', 'another one'])
  })

  it('returns defaults when optimization key is missing', async () => {
    await writeFile(join(matDir, 'config.yaml'), 'productName: test\n')
    const config = await getHumanizationConfig(matDir)
    expect(config.aiDetectionThreshold).toBe(20)
    expect(config.preserveKeywords).toBe(true)
  })

  it('returns defaults when humanization key is missing under optimization', async () => {
    await writeFile(join(matDir, 'config.yaml'), 'optimization:\n  somethingElse: true\n')
    const config = await getHumanizationConfig(matDir)
    expect(config.aiDetectionThreshold).toBe(20)
  })

  it('throws MATError for invalid YAML', async () => {
    await writeFile(join(matDir, 'config.yaml'), ':\n  invalid yaml: [[[')
    await expect(getHumanizationConfig(matDir)).rejects.toThrow(MATError)
  })

  it('reads enabledPlatforms from config', async () => {
    await writeFile(
      join(matDir, 'config.yaml'),
      'optimization:\n  humanization:\n    enabledPlatforms:\n      - reddit\n      - tiktok\n',
    )
    const config = await getHumanizationConfig(matDir)
    expect(config.enabledPlatforms).toEqual(['reddit', 'tiktok'])
  })

  it('reads preserveKeywords: false from config', async () => {
    await writeFile(
      join(matDir, 'config.yaml'),
      'optimization:\n  humanization:\n    preserveKeywords: false\n',
    )
    const config = await getHumanizationConfig(matDir)
    expect(config.preserveKeywords).toBe(false)
  })

  it('throws MATError for valid YAML with invalid Zod data', async () => {
    await writeFile(
      join(matDir, 'config.yaml'),
      'optimization:\n  humanization:\n    aiDetectionThreshold: "not-a-number"\n',
    )
    await expect(getHumanizationConfig(matDir)).rejects.toThrow(MATError)
  })

  it('throws MATError for out-of-range threshold in config file', async () => {
    await writeFile(
      join(matDir, 'config.yaml'),
      'optimization:\n  humanization:\n    aiDetectionThreshold: 200\n',
    )
    await expect(getHumanizationConfig(matDir)).rejects.toThrow(MATError)
  })
})
