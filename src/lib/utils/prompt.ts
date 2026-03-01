/**
 * Utility for detecting non-interactive terminals and handling prompt errors.
 *
 * @inquirer/prompts throws ExitPromptError when:
 * - The user presses Ctrl+C
 * - The terminal is non-interactive (e.g. piped, CI, Claude Code)
 * - stdin is closed unexpectedly
 */

/**
 * Returns true if the current process has an interactive TTY on stdin.
 * Non-interactive terminals (CI, piped input, Claude Code) return false.
 */
export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY)
}

/**
 * Returns true if the given error is an @inquirer/prompts ExitPromptError.
 * Uses name-based detection to avoid importing @inquirer/core as a direct dependency.
 */
export function isExitPromptError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError'
}
