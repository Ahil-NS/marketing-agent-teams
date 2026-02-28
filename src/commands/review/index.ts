import {Command} from '@oclif/core'

export default class Review extends Command {
  static override description = 'Manage content review queue'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 5.1.')
  }
}
