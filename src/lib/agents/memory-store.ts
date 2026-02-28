import {access, mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {dirname, join} from 'node:path'

import {memoryStateSchema} from '../schemas/index.js'

import {MemoryCorruptionError, MemoryStoreError} from './errors.js'
import type {AgentMemoryOptions, AgentMemoryState, MemoryEntry} from './types.js'

/** Regex allowing only kebab-case alphanumeric agent names */
const VALID_AGENT_NAME = /^[a-z\d]+(?:-[a-z\d]+)*$/

const DEFAULT_OPTIONS: AgentMemoryOptions = {
  maxEntries: 100,
  retentionDays: 90,
  memoryEnabled: true,
}

export class AgentMemoryStore {
  private readonly matDir: string

  /** In-memory mutex to serialize read-modify-write cycles per agent */
  private readonly locks = new Map<string, Promise<void>>()

  constructor(matDir: string = '.mat') {
    this.matDir = matDir
  }

  /** Validate that agentName is safe for filesystem paths (kebab-case only) */
  private validateAgentName(agentName: string): void {
    if (!VALID_AGENT_NAME.test(agentName)) {
      throw new MemoryStoreError(
        `Invalid agent name: "${agentName}"`,
        'MEMORY_STORE_INVALID_AGENT',
        `Agent name must be kebab-case alphanumeric (e.g., "trend-scout"). Got: "${agentName}"`,
        'Use only lowercase letters, numbers, and hyphens for agent names.',
        'memory-store',
        'permanent',
      )
    }
  }

  /** Serialize async operations per agent to prevent concurrent read-modify-write races */
  private async withLock<T>(agentName: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.locks.get(agentName) ?? Promise.resolve()
    let release!: () => void
    const nextLock = new Promise<void>((res) => {
      release = res
    })

    this.locks.set(agentName, nextLock)
    try {
      await existing
      return await fn()
    } finally {
      release()
      if (this.locks.get(agentName) === nextLock) {
        this.locks.delete(agentName)
      }
    }
  }

  /** Get the file path for an agent's memory state */
  private statePath(agentName: string): string {
    this.validateAgentName(agentName)
    return join(this.matDir, 'agents', agentName, 'state.json')
  }

  /** Load an agent's memory state from disk. Returns empty state if no file exists. */
  async load(agentName: string): Promise<AgentMemoryState> {
    const filePath = this.statePath(agentName)

    try {
      await access(filePath)
    } catch {
      // File does not exist — return empty state
      return {
        agentName,
        lastRunId: null,
        lastRunAt: null,
        entries: [],
        metadata: {},
      }
    }

    let raw: string
    try {
      raw = await readFile(filePath, 'utf-8')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new MemoryStoreError(
        `Failed to read memory state for agent "${agentName}"`,
        'MEMORY_STORE_READ_FAILED',
        `Could not read file: ${filePath} (${detail})`,
        `Check file permissions and disk space. Run: ls -la "${filePath}"`,
        'memory-store',
        'transient',
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new MemoryCorruptionError(
        `Corrupted memory state for agent "${agentName}"`,
        'MEMORY_STATE_CORRUPTED',
        `File contains invalid JSON: ${filePath} (${detail})`,
        `Delete the corrupted file and let the agent rebuild memory: rm "${filePath}"`,
        'memory-store',
        'permanent',
      )
    }

    const validated = memoryStateSchema.safeParse(parsed)
    if (!validated.success) {
      throw new MemoryCorruptionError(
        `Invalid memory state structure for agent "${agentName}"`,
        'MEMORY_STATE_CORRUPTED',
        `Schema validation failed: ${validated.error.message}`,
        `Delete the corrupted file and let the agent rebuild memory: rm ${filePath}`,
        'memory-store',
        'permanent',
      )
    }

    return validated.data
  }

  /** Save an agent's memory state to disk. Uses atomic write (write + rename). */
  async save(state: AgentMemoryState): Promise<void> {
    const validated = memoryStateSchema.safeParse(state)
    if (!validated.success) {
      throw new MemoryStoreError(
        `Invalid memory state for agent "${state.agentName}"`,
        'MEMORY_STORE_WRITE_FAILED',
        `Schema validation failed before write: ${validated.error.message}`,
        'Ensure the state object matches AgentMemoryState schema before saving.',
        'memory-store',
        'permanent',
      )
    }

    const filePath = this.statePath(state.agentName)
    const tmpPath = filePath + '.tmp'

    try {
      await mkdir(dirname(filePath), {recursive: true})
      await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8')
      await rename(tmpPath, filePath)
    } catch (error) {
      // Best-effort cleanup of orphaned .tmp file
      try {
        await unlink(tmpPath)
      } catch {
        /* ignore cleanup failure */
      }

      const detail = error instanceof Error ? error.message : String(error)
      throw new MemoryStoreError(
        `Failed to write memory state for agent "${state.agentName}"`,
        'MEMORY_STORE_WRITE_FAILED',
        `Could not write file: ${filePath} (${detail})`,
        'Check disk space and directory permissions for: ' + dirname(filePath),
        'memory-store',
        'transient',
      )
    }
  }

  /** Add a memory entry for an agent. Enforces maxEntries via FIFO eviction. */
  async addEntry(
    agentName: string,
    entry: Omit<MemoryEntry, 'id' | 'timestamp'>,
    options: AgentMemoryOptions = {},
  ): Promise<void> {
    const opts = {...DEFAULT_OPTIONS, ...options}
    if (!opts.memoryEnabled) return

    await this.withLock(agentName, async () => {
      const state = await this.load(agentName)

      const newEntry: MemoryEntry = {
        ...entry,
        id: randomUUID(),
        timestamp: new Date().toISOString(),
      }

      state.entries.push(newEntry)
      state.lastRunId = newEntry.runId
      state.lastRunAt = newEntry.timestamp

      // FIFO eviction — remove oldest entries when over limit
      const maxEntries = opts.maxEntries!
      while (state.entries.length > maxEntries) {
        state.entries.shift()
      }

      await this.save(state)
    })
  }

  /**
   * Build a human-readable context string from an agent's memory for prompt injection.
   * Returns empty string when no memory entries exist.
   */
  async getContextForPrompt(agentName: string): Promise<string> {
    const state = await this.load(agentName)

    if (state.entries.length === 0) {
      return ''
    }

    const sections: string[] = [
      '## Historical Context (from previous runs)',
      '',
    ]

    const learnings = state.entries.filter(e => e.type === 'learning')
    const rejections = state.entries.filter(e => e.type === 'rejection')
    const patterns = state.entries.filter(e => e.type === 'pattern')
    const preferences = state.entries.filter(e => e.type === 'preference')

    if (learnings.length > 0) {
      sections.push('### Learned Insights')
      for (const entry of learnings) {
        sections.push(`- ${entry.content} (confidence: ${entry.confidence}, source: ${entry.source})`)
      }

      sections.push('')
    }

    if (rejections.length > 0) {
      sections.push('### Rejected Approaches (avoid these)')
      for (const entry of rejections) {
        sections.push(`- ${entry.content} (source: ${entry.source})`)
      }

      sections.push('')
    }

    if (patterns.length > 0) {
      sections.push('### Observed Patterns')
      for (const entry of patterns) {
        sections.push(`- ${entry.content} (confidence: ${entry.confidence})`)
      }

      sections.push('')
    }

    if (preferences.length > 0) {
      sections.push('### User Preferences')
      for (const entry of preferences) {
        sections.push(`- ${entry.content}`)
      }

      sections.push('')
    }

    return sections.join('\n')
  }

  /** Remove entries older than retentionDays. Returns count of pruned entries. */
  async prune(
    agentName: string,
    options: AgentMemoryOptions = {},
  ): Promise<number> {
    return this.withLock(agentName, async () => {
      const opts = {...DEFAULT_OPTIONS, ...options}
      const state = await this.load(agentName)
      const retentionDays = opts.retentionDays!
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - retentionDays)

      const before = state.entries.length
      state.entries = state.entries.filter(
        e => new Date(e.timestamp) >= cutoff,
      )
      const pruned = before - state.entries.length

      if (pruned > 0) {
        await this.save(state)
      }

      return pruned
    })
  }

  /** Delete all memory for an agent. Idempotent — no error if already missing. */
  async clear(agentName: string): Promise<void> {
    const filePath = this.statePath(agentName)
    try {
      await unlink(filePath)
    } catch (error: unknown) {
      // Ignore ENOENT — file already missing is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new MemoryStoreError(
          `Failed to clear memory for agent "${agentName}"`,
          'MEMORY_STORE_WRITE_FAILED',
          `Could not delete file: ${filePath}`,
          'Check file permissions for: ' + filePath,
          'memory-store',
          'transient',
        )
      }
    }
  }
}
