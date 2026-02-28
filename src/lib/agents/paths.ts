import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

/**
 * Resolve the agents root directory.
 * Agent SKILL.md definitions live in src/agents/ relative to the project root.
 * This file is at src/lib/agents/paths.ts → navigate ../../agents/.
 */
export function agentsRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  return join(__dirname, '..', '..', 'agents')
}
