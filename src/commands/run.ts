import {Command} from '@oclif/core'

export default class Run extends Command {
  static override description = 'Run a marketing pipeline'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 2.2.')
  }
}
