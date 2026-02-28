import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import YAML from 'yaml'

import {DEFAULT_AGENTS, DEFAULT_BRAND_VOICE} from '../../templates/config-defaults.js'
import {SetupError, SETUP_CONFIG_WRITE_FAILED, SETUP_SCAFFOLD_FAILED} from './errors.js'
import type {WizardAnswers} from './wizard.js'

const DIRECTORIES = [
  'state/pipeline-runs',
  'state/review-queue',
  'state/retry-queue',
  'agents',
  'content',
  'credentials',
  'logs',
] as const

export async function scaffoldProject(targetDir: string, answers: WizardAnswers): Promise<void> {
  const matDir = join(targetDir, '.mat')

  try {
    await mkdir(matDir, {recursive: true})
    for (const dir of DIRECTORIES) {
      await mkdir(join(matDir, dir), {recursive: true})
    }
  } catch (error) {
    throw new SetupError(
      'Failed to create .mat/ directory structure',
      SETUP_SCAFFOLD_FAILED,
      `Could not create directories in ${matDir}: ${error instanceof Error ? error.message : String(error)}`,
      'Check file system permissions and available disk space',
      'setup/scaffolder',
      'permanent',
    )
  }

  try {
    const config = {
      productName: answers.productName,
      platforms: answers.platforms,
      skillLevel: answers.skillLevel,
      brandVoice: {...DEFAULT_BRAND_VOICE},
      agents: {...DEFAULT_AGENTS},
    }
    await writeFile(join(matDir, 'config.yaml'), YAML.stringify(config), 'utf-8')
  } catch (error) {
    throw new SetupError(
      'Failed to write config.yaml',
      SETUP_CONFIG_WRITE_FAILED,
      `Could not write config file: ${error instanceof Error ? error.message : String(error)}`,
      'Check file system permissions and available disk space',
      'setup/scaffolder',
      'permanent',
    )
  }

  try {
    const credentialsMeta = {platforms: {}}
    await writeFile(join(matDir, 'credentials', 'platforms.json'), JSON.stringify(credentialsMeta, null, 2), 'utf-8')
  } catch (error) {
    throw new SetupError(
      'Failed to write credentials metadata',
      SETUP_CONFIG_WRITE_FAILED,
      `Could not write platforms.json: ${error instanceof Error ? error.message : String(error)}`,
      'Check file system permissions and available disk space',
      'setup/scaffolder',
      'permanent',
    )
  }
}
