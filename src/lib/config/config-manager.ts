import {readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import YAML from 'yaml'

import {configSchema} from '../schemas/index.js'
import type {Config} from '../schemas/index.js'
import {ConfigReadError, ConfigValidationError, ConfigWriteError} from './errors.js'

export interface ConfigResult {
  raw: Record<string, unknown>
  validated: Config
}

export function getConfigPath(projectDir: string): string {
  return join(projectDir, '.mat', 'config.yaml')
}

export async function readConfig(projectDir: string): Promise<ConfigResult> {
  const configPath = getConfigPath(projectDir)

  let content: string
  try {
    content = await readFile(configPath, 'utf-8')
  } catch (error) {
    throw new ConfigReadError(
      `Could not read ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      'Ensure .mat/config.yaml exists. Run `mat install` if needed.',
    )
  }

  const raw = YAML.parse(content) as Record<string, unknown>
  const parseResult = configSchema.safeParse(raw)
  if (!parseResult.success) {
    throw new ConfigValidationError(
      `Config validation failed: ${parseResult.error.message}`,
      'Fix your .mat/config.yaml or run `mat install` to re-create it.',
    )
  }

  return {raw, validated: parseResult.data}
}

export async function writeConfig(projectDir: string, config: Record<string, unknown>): Promise<void> {
  const parseResult = configSchema.safeParse(config)
  if (!parseResult.success) {
    throw new ConfigValidationError(
      `Updated config is invalid: ${parseResult.error.message}`,
      'This is likely a bug. Please report it.',
    )
  }

  const configPath = getConfigPath(projectDir)
  try {
    await writeFile(configPath, YAML.stringify(config), 'utf-8')
  } catch (error) {
    throw new ConfigWriteError(
      `Could not write ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      'Check file system permissions and available disk space.',
    )
  }
}
