import {MATError} from '../utils/errors.js'

export class LogWriteError extends MATError {
  constructor(runId: string, cause: string) {
    super(
      `Failed to write log entry for run ${runId}`,
      'LOG_WRITE_FAILED',
      cause,
      'Check disk space and file permissions in .mat/logs/',
      'logging',
      'transient',
    )
  }
}

export class LogNotFoundError extends MATError {
  constructor(runId: string) {
    super(
      `No log file found for run ${runId}`,
      'LOG_NOT_FOUND',
      `Log file .mat/logs/${runId}/pipeline.ndjson does not exist`,
      'Run `mat status --history` to see available run IDs',
      'logging',
      'permanent',
    )
  }
}
