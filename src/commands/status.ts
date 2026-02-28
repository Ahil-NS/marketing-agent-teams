import {Command, Flags} from '@oclif/core'

import {formatRunStatus, formatRunSummary} from '../lib/logging/index.js'
import {listPipelineRuns, loadPipelineRun} from '../lib/orchestrator/index.js'
import type {PipelineRun} from '../lib/orchestrator/index.js'
import {MATError} from '../lib/utils/errors.js'

export default class Status extends Command {
  static override description = 'Show pipeline run status, errors, and resolution paths'

  static enableJsonFlag = true

  static override flags = {
    history: Flags.boolean({
      default: false,
      description: 'Show summary of all past pipeline runs',
    }),
    'run-id': Flags.string({
      description: 'Show status for a specific pipeline run',
      required: false,
    }),
  }

  async run(): Promise<PipelineRun | PipelineRun[] | null> {
    const {flags} = await this.parse(Status)

    const projectDir = process.cwd()

    try {
      if (flags.history) {
        const runIds = await listPipelineRuns(projectDir)
        const runs: PipelineRun[] = []
        for (const id of runIds) {
          try {
            const run = await loadPipelineRun(id, projectDir)
            runs.push(run)
          } catch {
            this.warn(`Skipping corrupted pipeline run: ${id}`)
          }
        }

        this.log(formatRunSummary(runs))
        return runs
      }

      let run: PipelineRun | null = null

      if (flags['run-id']) {
        run = await loadPipelineRun(flags['run-id'], projectDir)
      } else {
        // Load the most recent run
        const runIds = await listPipelineRuns(projectDir)
        if (runIds.length > 0) {
          run = await loadPipelineRun(runIds[0], projectDir)
        }
      }

      if (!run) {
        this.log('No pipeline runs found. Run `mat run` to start a pipeline.')
        return null
      }

      this.log(formatRunStatus(run))
      return run
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
      }

      throw error
    }
  }
}
