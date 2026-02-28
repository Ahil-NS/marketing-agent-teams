import {Command} from '@oclif/core'

export default class Status extends Command {
  static override description = 'Show pipeline and agent status'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 2.7.')
  }
}
