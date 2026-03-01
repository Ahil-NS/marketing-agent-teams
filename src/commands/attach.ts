import {join} from 'node:path'

import {Args, Command} from '@oclif/core'

import {TmuxSessionManager, TmuxNotFoundError} from '../lib/tmux/index.js'
import {listRecentLogDirs, formatActiveSessionList, formatNoActiveSessions} from '../lib/tmux/logger.js'
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
    const matDir = join(process.cwd(), '.mat')

    if (args['run-id']) {
      // Reattach requires tmux
      if (!TmuxSessionManager.isAvailable()) {
        this.error(new TmuxNotFoundError().message)
        return
      }

      try {
        manager.attach(args['run-id'])
      } catch (error) {
        if (error instanceof MATError) {
          this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
        }

        throw error
      }

      return
    }

    // No run-id provided — list active sessions or recent logs
    if (TmuxSessionManager.isAvailable()) {
      const activeSessions = manager.list()

      if (activeSessions.length > 0) {
        this.log(formatActiveSessionList(activeSessions))
        return
      }
    }

    // No active sessions (or tmux not installed) — show recent completed runs
    const recentRuns = listRecentLogDirs(matDir)
    this.log(formatNoActiveSessions(recentRuns))
  }
}
