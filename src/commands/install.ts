import {Command} from '@oclif/core'

import {checkExistingProject, runSetupWizard} from '../lib/setup/index.js'
import {isExitPromptError, isInteractiveTerminal} from '../lib/utils/index.js'

export default class Install extends Command {
  static override description = 'Set up a new Marketing Agent Teams project'

  async run(): Promise<void> {
    await this.parse()

    if (!isInteractiveTerminal()) {
      this.error(
        'mat install requires an interactive terminal.\n' +
        'Run this command directly in your terminal (not inside a script, pipe, or AI agent terminal).',
      )
    }

    const targetDir = process.cwd()

    try {
      const proceed = await checkExistingProject(targetDir)
      if (!proceed) {
        this.log('Setup cancelled.')
        return
      }

      await runSetupWizard(targetDir)
      this.log('Project setup complete! Your .mat/ directory is ready.')
    } catch (error) {
      if (isExitPromptError(error)) {
        this.log('\nSetup cancelled.')
        return
      }

      throw error
    }
  }
}
