import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

/**
 * Find the project root by walking up from the current file to find package.json.
 * This is stable regardless of tsup bundle output location.
 */
function findProjectRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir
    }
    dir = dirname(dir)
  }
  // Fallback: assume cwd is the project root
  return process.cwd()
}

/**
 * Resolve the agents root directory.
 * Agent SKILL.md definitions live in src/agents/ relative to the project root.
 */
export function agentsRoot(): string {
  return join(findProjectRoot(), 'src', 'agents')
}
