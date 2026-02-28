export type ErrorSeverity = 'transient' | 'permanent'

export class MATError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly reason: string,
    public readonly resolution: string,
    public readonly source: string,
    public readonly severity: ErrorSeverity,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

// CLI error codes
export const CLI_COMMAND_NOT_FOUND = 'CLI_COMMAND_NOT_FOUND'
