import {Command, Flags} from '@oclif/core'
import {z} from 'zod'

import {createExecutor} from '../lib/agent-executor/executor-factory.js'
import type {ExecutionMode} from '../lib/agent-executor/executor-factory.js'
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
    posts: Flags.integer({
      description: 'Number of content items per platform (1 = focused/fast, 3+ = full agent set)',
      default: 1,
    }),
    mode: Flags.string({
      description: 'Execution mode: native (claude -p), sdk (Agent SDK query), auto (detect)',
      options: ['native', 'sdk', 'auto'],
      default: 'auto',
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
    const config: OrchestratorConfig = {
      ...orchestratorConfigSchema.parse({
        platforms: flags.platforms ?? ['reddit'],
        dryRun: flags['dry-run'],
        budgetLimit: flags.budget ?? 10,
        disabledAgents: [],
        projectRoot,
      }),
      postsPerPlatform: flags.posts,
    }

    const executionMode = flags.mode as ExecutionMode
    const executor = createExecutor(executionMode)
    const stageRunner = new StageRunner({executor})

    try {
      const events = {
        onStageStart: (stage: string) => this.log(`\n▶ Stage: ${stage}`),
        onStageComplete: (stage: string, result: {status: string; agentResults: Record<string, {status: string; result?: {outputs?: unknown; usage?: {cost?: number; inputTokens?: number; outputTokens?: number}} | null}>}) => {
          const agents = Object.entries(result.agentResults)
          const succeeded = agents.filter(([, r]) => r.status === 'success').length
          for (const [name, r] of agents) {
            if (r.status === 'success' && r.result?.outputs) {
              const cost = r.result.usage?.cost ? ` ($${r.result.usage.cost.toFixed(4)})` : ''
              const tokens = r.result.usage ? ` [${r.result.usage.inputTokens}→${r.result.usage.outputTokens} tokens]` : ''
              const output = JSON.stringify(r.result.outputs, null, 2)
              const preview = output.length > 500 ? output.slice(0, 500) + '\n    ...(truncated)' : output
              this.log(`  ✓ ${name}${cost}${tokens}`)
              this.log(`    ${preview.split('\n').join('\n    ')}`)
            }
          }
          this.log(`  ${stage}: ${succeeded}/${agents.length} agents succeeded`)
        },
        onAgentFailed: (agentName: string, error: Error) => {
          this.warn(`  ✗ ${agentName}: ${error.message}`)
        },
        onPipelinePaused: (stage: string) => {
          this.log(`\n⏸ Pipeline paused at ${stage}`)
        },
      }

      const orchestrator = flags.resume
        ? await Orchestrator.resume(flags.resume, config, stageRunner, events)
        : await Orchestrator.create(config, stageRunner, events)

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
