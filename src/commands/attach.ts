import {Args, Command} from '@oclif/core'

import {listPipelineRuns} from '../lib/orchestrator/index.js'
import {TmuxSessionManager, TmuxNotFoundError} from '../lib/tmux/index.js'
import {MATError} from '../lib/utils/errors.js'

export default class Attach extends Command {
  static override args = {
    'run-id': Args.string({
      description: 'Pipeline run ID to attach to',
      required: false,
    }),
  }

  static override description = 'Attach to a tmux pipeline session'

  async run(): Promise<void> {
    const {args} = await this.parse(Attach)
    const manager = new TmuxSessionManager()

    if (!TmuxSessionManager.isAvailable()) {
      this.error(new TmuxNotFoundError().message)
      return
    }

    try {
      if (args['run-id']) {
        manager.attach(args['run-id'])
        return
      }

      // No run-id provided — list active sessions
      const activeSessions = manager.list()

      if (activeSessions.length > 0) {
        this.log('Active pipeline sessions:')
        for (const runId of activeSessions) {
          this.log(`  mat-${runId}`)
        }

        this.log('')
        this.log('Attach with: mat attach <run-id>')
        return
      }

      // No active sessions — show recent completed runs
      this.log('No active pipeline sessions.')
      const projectDir = process.cwd()
      try {
        const recentRuns = await listPipelineRuns(projectDir)
        if (recentRuns.length > 0) {
          this.log('')
          this.log('Recent completed runs:')
          for (const runId of recentRuns.slice(0, 5)) {
            this.log(`  ${runId}`)
          }

          this.log('')
          this.log('Start a new session with: mat run --tmux')
        }
      } catch {
        // Ignore errors listing past runs
      }
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
      }

      throw error
    }
  }
}
