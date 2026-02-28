import {Args, Command, Flags} from '@oclif/core'

import {formatTestResult, runAgentTest} from '../../lib/agent-testing/index.js'
import type {AgentTestOptions} from '../../lib/agent-testing/types.js'
import {MATError} from '../../lib/utils/errors.js'

export default class AgentsTest extends Command {
  static override args = {
    name: Args.string({
      description: 'Name of the agent to test (e.g., trend-scout)',
      required: true,
    }),
  }

  static override description = 'Test an agent in isolation outside the pipeline'

  static enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> agents test trend-scout',
    '<%= config.bin %> agents test trend-scout --input ./test-inputs.json',
    '<%= config.bin %> agents test trend-scout --model sonnet',
    '<%= config.bin %> agents test trend-scout --json',
  ]

  static override flags = {
    input: Flags.string({
      char: 'i',
      description: 'Path to JSON file with test inputs',
    }),
    'max-turns': Flags.integer({
      description: 'Maximum conversation turns (default: 15)',
    }),
    model: Flags.string({
      description: 'Override agent model (haiku or sonnet)',
      options: ['haiku', 'sonnet'],
    }),
  }

  async run(): Promise<Record<string, unknown> | void> {
    const {args, flags} = await this.parse(AgentsTest)

    const options: AgentTestOptions = {
      inputPath: flags.input,
      json: flags.json,
      maxTurns: flags['max-turns'],
      model: flags.model as 'haiku' | 'sonnet' | undefined,
    }

    try {
      const result = await runAgentTest(args.name, options)

      if (flags.json) {
        return result as unknown as Record<string, unknown>
      }

      this.log(formatTestResult(result, false))
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`${error.message}\n\nReason: ${error.reason}\nResolution: ${error.resolution}`, {
          code: error.code,
          exit: 1,
        })
      }

      throw error
    }
  }
}
