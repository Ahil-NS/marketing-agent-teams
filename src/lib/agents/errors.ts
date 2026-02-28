import {MATError} from '../utils/errors.js'

export class AgentExecutionError extends MATError {
  constructor(agentName: string, code: string, message: string) {
    super(
      message,
      code,
      `Agent '${agentName}' execution failed`,
      'Check agent configuration, authentication, and budget limits. Retry if transient.',
      `agents/${agentName}`,
      'transient',
    )
  }
}

export class AgentTimeoutError extends MATError {
  constructor(agentName: string, detail: string) {
    super(
      `Agent '${agentName}' timed out: ${detail}`,
      'AGENT_TIMEOUT',
      `Agent '${agentName}' exceeded maximum turns or time limit`,
      'Increase maxTurns or simplify the agent prompt. Consider breaking the task into smaller steps.',
      `agents/${agentName}`,
      'transient',
    )
  }
}

export class AgentValidationError extends MATError {
  constructor(agentName: string, zodError: unknown) {
    const detail = zodError instanceof Error ? zodError.message : String(zodError)
    super(
      `Agent '${agentName}' output validation failed: ${detail}`,
      'AGENT_VALIDATION_FAILED',
      `Agent '${agentName}' returned output that doesn't match the expected schema`,
      'Review the agent system prompt to ensure it produces valid JSON matching the output schema.',
      `agents/${agentName}`,
      'permanent',
    )
  }
}
