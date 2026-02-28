import {MATError} from '../utils/errors.js'

export const AUTH_CLAUDE_NOT_INSTALLED = 'AUTH_CLAUDE_NOT_INSTALLED'
export const AUTH_CLAUDE_NOT_AUTHENTICATED = 'AUTH_CLAUDE_NOT_AUTHENTICATED'

export class ClaudeNotInstalledError extends MATError {
  constructor() {
    super(
      'Claude Code CLI is not installed or not in PATH',
      AUTH_CLAUDE_NOT_INSTALLED,
      'Claude Code CLI is not installed or not in PATH',
      'Install Claude Code from https://claude.com/download, then run `claude` to authenticate',
      'auth/claude-auth',
      'permanent',
    )
  }
}

export class ClaudeNotAuthenticatedError extends MATError {
  constructor() {
    super(
      'Claude Code CLI is installed but not authenticated',
      AUTH_CLAUDE_NOT_AUTHENTICATED,
      'Claude Code CLI is installed but not authenticated',
      'Run `claude login` to authenticate your Claude Code account',
      'auth/claude-auth',
      'permanent',
    )
  }
}
