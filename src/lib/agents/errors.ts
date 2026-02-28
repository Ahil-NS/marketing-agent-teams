import {MATError} from '../utils/errors.js'
import type {ErrorSeverity} from '../utils/errors.js'

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

export class MemoryStoreError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class MemoryCorruptionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

/**
 * Error thrown when loading or validating a SKILL.md agent definition.
 *
 * Error codes:
 * - SKILL_NOT_FOUND — SKILL.md file does not exist at expected path
 * - SKILL_PARSE_FAILED — YAML front matter is malformed
 * - SKILL_VALIDATION_FAILED — Front matter does not match agentDefinitionSchema
 * - SKILL_KNOWLEDGE_READ_FAILED — A file in knowledge/ cannot be read
 * - SKILL_TEMPLATE_READ_FAILED — A file in templates/ cannot be read
 *
 * Each error includes NFR27 three-part message: what happened, why, and how to fix.
 */
export class SkillLoadError extends MATError {
  constructor(
    /** Path to the agent directory or file that caused the error */
    public readonly agentPath: string,
    /** Which field or component failed */
    public readonly field: string,
    /** Error code */
    code: string,
    /** Why the error happened */
    reason: string,
    /** How to fix it */
    resolution: string,
  ) {
    super(
      `Failed to load agent skill at "${agentPath}": ${reason}`,
      code,
      reason,
      resolution,
      `skill-loader:${field}`,
      'permanent' as ErrorSeverity,
    )
  }
}
