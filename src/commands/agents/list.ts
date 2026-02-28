import {Command} from '@oclif/core'

export default class AgentsList extends Command {
  static override description = 'List available agents and their status'

  async run(): Promise<void> {
    await this.parse()
    this.log('Not yet implemented. Coming in Story 2.3.')
  }
}
