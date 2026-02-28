import {readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import YAML from 'yaml'

import {configSchema} from '../schemas/index.js'
import type {Config} from '../schemas/index.js'
import {MATError} from '../utils/errors.js'

export interface ConfigResult {
  raw: Record<string, unknown>
  validated: Config
}

export async function readConfig(projectDir: string): Promise<ConfigResult> {
  const configPath = join(projectDir, '.mat', 'config.yaml')

  let content: string
  try {
    content = await readFile(configPath, 'utf-8')
  } catch (error) {
    throw new MATError(
      'Failed to read config.yaml',
      'CONFIG_READ_FAILED',
      `Could not read ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      'Ensure .mat/config.yaml exists. Run `mat install` if needed.',
      'lib/config',
      'permanent',
    )
  }

  const raw = YAML.parse(content) as Record<string, unknown>
  const parseResult = configSchema.safeParse(raw)
  if (!parseResult.success) {
    throw new MATError(
      'Invalid config.yaml',
      'CONFIG_VALIDATION_FAILED',
      `Config validation failed: ${parseResult.error.message}`,
      'Fix your .mat/config.yaml or run `mat install` to re-create it.',
      'lib/config',
      'permanent',
    )
  }

  return {raw, validated: parseResult.data}
}

export async function writeConfig(projectDir: string, config: Record<string, unknown>): Promise<void> {
  const parseResult = configSchema.safeParse(config)
  if (!parseResult.success) {
    throw new MATError(
      'Config validation failed before write',
      'CONFIG_WRITE_VALIDATION_FAILED',
      `Updated config is invalid: ${parseResult.error.message}`,
      'This is likely a bug. Please report it.',
      'lib/config',
      'permanent',
    )
  }

  const configPath = join(projectDir, '.mat', 'config.yaml')
  try {
    await writeFile(configPath, YAML.stringify(config), 'utf-8')
  } catch (error) {
    throw new MATError(
      'Failed to write config.yaml',
      'CONFIG_WRITE_FAILED',
      `Could not write ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      'Check file system permissions and available disk space.',
      'lib/config',
      'permanent',
    )
  }
}
