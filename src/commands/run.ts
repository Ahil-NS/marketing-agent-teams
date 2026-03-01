import {Command, Flags} from '@oclif/core'
import {z} from 'zod'

import {Orchestrator, StageRunner} from '../lib/orchestrator/index.js'
import type {OrchestratorConfig} from '../lib/orchestrator/index.js'
import {TmuxSessionManager, TmuxNotFoundError} from '../lib/tmux/index.js'
import {MATError} from '../lib/utils/errors.js'

const orchestratorConfigSchema = z.object({
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  dryRun: z.boolean(),
  budgetLimit: z.number().positive('Budget limit must be greater than 0'),
  disabledAgents: z.array(z.string()),
  projectRoot: z.string().min(1),
})

export default class Run extends Command {
  static override description = 'Run a marketing pipeline'

  static override flags = {
    platforms: Flags.string({
      char: 'p',
      description: 'Target platforms (comma-separated)',
      multiple: true,
    }),
    'dry-run': Flags.boolean({
      description: 'Generate content without publishing',
      default: false,
    }),
    resume: Flags.string({
      description: 'Resume a paused or failed pipeline run by ID',
    }),
    budget: Flags.integer({
      description: 'Budget limit in USD (overrides config)',
    }),
    tmux: Flags.boolean({
      description: 'Create a managed tmux session with per-stage panes',
      default: false,
    }),
    kill: Flags.string({
      description: 'Kill a tmux session for the given run-id',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Run)

    // Handle --kill flag: destroy a tmux session and exit
    if (flags.kill) {
      const manager = new TmuxSessionManager()
      try {
        manager.destroy(flags.kill)
        this.log(`Killed tmux session for run: ${flags.kill}`)
      } catch (error) {
        if (error instanceof MATError) {
          this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
        }

        throw error
      }

      return
    }

    const projectRoot = process.cwd()
    const config: OrchestratorConfig = orchestratorConfigSchema.parse({
      platforms: flags.platforms ?? ['reddit'],
      dryRun: flags['dry-run'],
      budgetLimit: flags.budget ?? 10,
      disabledAgents: [],
      projectRoot,
    })

    const stageRunner = new StageRunner()

    try {
      const orchestrator = flags.resume
        ? await Orchestrator.resume(flags.resume, config, stageRunner)
        : await Orchestrator.create(config, stageRunner)

      // Create tmux session before pipeline execution if --tmux flag is set
      let tmuxSession: string | undefined
      if (flags.tmux) {
        const manager = new TmuxSessionManager()
        try {
          tmuxSession = manager.create(orchestrator.getRunId())
          this.log(`tmux session created: ${tmuxSession}`)
          this.log('Detach with Ctrl-B d. Reattach with: mat attach')
        } catch (error) {
          if (error instanceof TmuxNotFoundError) {
            this.warn(error.message)
          } else {
            throw error
          }
        }
      }

      const result = await orchestrator.execute()
      this.log(`Pipeline ${result.status}: ${result.id}`)

      if (result.status === 'paused') {
        this.log('Pipeline paused at review stage. Use `mat review list` to review content.')
        this.log(`Resume with: mat run --resume ${result.id}`)
      }

      if (result.status === 'completed') {
        this.log('All stages completed successfully.')
      }

      if (result.errors.length > 0) {
        this.warn(`${result.errors.length} error(s) recorded during execution.`)
        this.log('Run `mat status` for details.')
      }

      if (tmuxSession) {
        this.log(`tmux session "${tmuxSession}" is still open for log review.`)
        this.log(`Kill with: mat run --kill ${result.id}`)
      }
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
      }

      throw error
    }
  }
}
