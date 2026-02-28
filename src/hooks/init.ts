import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {Hook} from '@oclif/core'
import YAML from 'yaml'

import {configSchema} from '../lib/schemas/index.js'
import type {Config} from '../lib/schemas/index.js'
import {MATError} from '../lib/utils/errors.js'

const SKIP_COMMANDS = new Set(['install', 'help'])

export function shouldSkipValidation(commandId: string): boolean {
  return SKIP_COMMANDS.has(commandId)
}

export async function validateProject(targetDir: string): Promise<Config> {
  const matDir = join(targetDir, '.mat')

  if (!existsSync(matDir)) {
    throw new MATError(
      'No .mat/ directory found',
      'PROJECT_NOT_INITIALIZED',
      'This directory is not a Marketing Agent Teams project',
      'Run `mat install` first to set up your project',
      'hooks/init',
      'permanent',
    )
  }

  const configPath = join(matDir, 'config.yaml')
  if (!existsSync(configPath)) {
    throw new MATError(
      'No config.yaml found',
      'CONFIG_MISSING',
      '.mat/ directory exists but config.yaml is missing',
      'Run `mat install` to re-create your project configuration',
      'hooks/init',
      'permanent',
    )
  }

  const content = await readFile(configPath, 'utf-8')
  const raw = YAML.parse(content)
  const result = configSchema.safeParse(raw)

  if (!result.success) {
    throw new MATError(
      'Invalid config.yaml',
      'CONFIG_INVALID',
      `Config validation failed: ${result.error.message}`,
      'Fix your .mat/config.yaml or run `mat install` to re-create it',
      'hooks/init',
      'permanent',
    )
  }

  return result.data
}

const hook: Hook.Init = async function (options) {
  const commandId = options.id
  if (!commandId || shouldSkipValidation(commandId)) {
    return
  }

  try {
    await validateProject(process.cwd())
  } catch (error) {
    if (error instanceof MATError) {
      // TODO: Change to this.error() when commands have real implementations
      // that depend on config. Currently warn-only because stub commands don't
      // use config and this.error() aborts before the command can run.
      this.warn(`${error.reason}\n${error.resolution}`)
    }
  }
}

export default hook
