import {existsSync} from 'node:fs'
import {join} from 'node:path'

import {confirm} from '@inquirer/prompts'

import {scaffoldProject} from './scaffolder.js'
import {promptWizard, verifyClaude} from './wizard.js'

export {checkExistingProject, runSetupWizard}

async function checkExistingProject(targetDir: string): Promise<boolean> {
  const matDir = join(targetDir, '.mat')
  if (existsSync(matDir)) {
    const overwrite = await confirm({
      message: 'A .mat/ directory already exists. Overwrite existing configuration?',
      default: false,
    })
    return overwrite
  }

  return true
}

async function runSetupWizard(targetDir: string): Promise<void> {
  await verifyClaude()
  const answers = await promptWizard()
  await scaffoldProject(targetDir, answers)
}
