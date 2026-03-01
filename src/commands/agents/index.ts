import {Command, Help} from '@oclif/core'

export default class AgentsIndex extends Command {
  static override args = {}
  static override description = 'Manage agents'
  static override strict = true

  async run(): Promise<void> {
    const help = new Help(this.config)
    await help.showHelp(['agents'])
  }
}
