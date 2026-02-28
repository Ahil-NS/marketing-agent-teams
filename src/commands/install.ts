import {Command} from '@oclif/core'

export default class Install extends Command {
  static override description = 'Set up a new Marketing Agent Teams project'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 1.2.')
  }
}
