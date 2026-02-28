import {Command} from '@oclif/core'

export default class Config extends Command {
  static override description = 'View and modify configuration'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 1.5.')
  }
}
