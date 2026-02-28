import {Command} from '@oclif/core'

export default class Logs extends Command {
  static override description = 'View pipeline and agent logs'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 2.7.')
  }
}
