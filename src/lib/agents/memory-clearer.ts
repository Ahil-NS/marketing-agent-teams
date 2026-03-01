import {readdir} from 'node:fs/promises'
import {join} from 'node:path'

import {AgentMemoryStore} from './memory-store.js'

/**
 * Clear all memory entries for a specific agent.
 * Loads the current state to count entries, then deletes the state file.
 * Returns the count of entries removed. Idempotent — no error if no state exists.
 *
 * Does NOT affect SKILL.md or knowledge files — only clears runtime state.
 */
export async function clearAgentMemory(
  agentName: string,
  matDir: string = '.mat',
): Promise<{cleared: boolean; entriesRemoved: number}> {
  const store = new AgentMemoryStore(matDir)

  const state = await store.load(agentName)
  const entriesRemoved = state.entries.length

  if (entriesRemoved === 0) {
    return {cleared: false, entriesRemoved: 0}
  }

  await store.clear(agentName)

  return {cleared: true, entriesRemoved}
}

/**
 * Clear memory for all agents that have state files.
 * Scans the `.mat/agents/` directory for agent subdirectories,
 * clears each one, and returns a summary.
 *
 * Does NOT affect SKILL.md or knowledge files — only clears runtime state.
 */
export async function clearAllAgentMemory(
  matDir: string = '.mat',
): Promise<{agentsCleared: string[]; totalEntriesRemoved: number}> {
  const agentsDir = join(matDir, 'agents')
  const agentsCleared: string[] = []
  let totalEntriesRemoved = 0

  let entries: string[]
  try {
    entries = await readdir(agentsDir)
  } catch {
    // Directory doesn't exist — no agents to clear
    return {agentsCleared: [], totalEntriesRemoved: 0}
  }

  for (const agentName of entries) {
    const result = await clearAgentMemory(agentName, matDir)
    if (result.cleared) {
      agentsCleared.push(agentName)
      totalEntriesRemoved += result.entriesRemoved
    }
  }

  return {agentsCleared, totalEntriesRemoved}
}
