import {MATError} from '../utils/errors.js'

export class AgentTestError extends MATError {
  constructor(agentName: string, detail: string) {
    super(
      `Agent test failed for "${agentName}": ${detail}`,
      'AGENT_TEST_FAILED',
      `The agent "${agentName}" encountered an error during isolated test execution`,
      'Check the agent SKILL.md definition, verify Claude Code authentication with `claude login`, and ensure inputs are valid',
      'agent-testing',
      'transient',
    )
  }
}

export class AgentNotFoundError extends MATError {
  constructor(agentName: string) {
    super(
      `Agent "${agentName}" not found`,
      'AGENT_NOT_FOUND',
      `No SKILL.md definition exists for agent "${agentName}" in src/agents/`,
      'Run `mat agents list` to see available agents. Agent names use kebab-case (e.g., trend-scout, content-strategist)',
      'agent-testing',
      'permanent',
    )
  }
}

export class TestInputError extends MATError {
  constructor(source: string, detail: string, fix: string) {
    super(
      `Test input error: ${detail}`,
      'TEST_INPUT_INVALID',
      detail,
      fix,
      source,
      'permanent',
    )
  }
}
