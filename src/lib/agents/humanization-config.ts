import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {parse as parseYaml} from 'yaml'

import {humanizationConfigSchema} from '../schemas/humanization-schema.js'
import type {HumanizationConfig} from '../schemas/humanization-schema.js'
import {MATError} from '../utils/errors.js'

export async function getHumanizationConfig(matDir: string): Promise<HumanizationConfig> {
  const configPath = join(matDir, 'config.yaml')

  try {
    const raw = await readFile(configPath, 'utf-8')
    const parsed = parseYaml(raw) as Record<string, unknown>
    const optimization = (parsed.optimization ?? {}) as Record<string, unknown>
    const humanization = optimization.humanization ?? {}

    return humanizationConfigSchema.parse(humanization)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No config file — return defaults
      return humanizationConfigSchema.parse({})
    }

    if (error instanceof MATError) throw error

    throw new MATError(
      'Failed to read humanization configuration',
      'HUMANIZATION_CONFIG_READ_FAILED',
      String(error),
      'Check .mat/config.yaml syntax and humanization config structure',
      'agents/humanization-config',
      'permanent',
    )
  }
}
