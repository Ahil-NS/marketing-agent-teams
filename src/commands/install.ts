import {Command} from '@oclif/core'

import {checkExistingProject, runSetupWizard} from '../lib/setup/index.js'

export default class Install extends Command {
  static override description = 'Set up a new Marketing Agent Teams project'

  async run(): Promise<void> {
    await this.parse()

    const targetDir = process.cwd()

    const proceed = await checkExistingProject(targetDir)
    if (!proceed) {
      this.log('Setup cancelled.')
      return
    }

    await runSetupWizard(targetDir)
    this.log('Project setup complete! Your .mat/ directory is ready.')
  }
}
