import type {RejectionPattern} from '../schemas/rejection-schema.js'

import type {AgentMemoryStore} from './memory-store.js'

/**
 * Builds deprioritization context from rejection history for injection
 * into intelligence agent system prompts.
 *
 * Groups similar rejections by keyword overlap (Jaccard similarity >= 50%),
 * then formats them as negative guidance the agent uses to avoid previously
 * rejected content angles.
 */
export class Deprioritizer {
  private readonly memoryStore: AgentMemoryStore

  constructor(memoryStore: AgentMemoryStore) {
    this.memoryStore = memoryStore
  }

  /**
   * Build a deprioritization context string for injection into an agent's system prompt.
   * Returns empty string if no rejections exist for the agent.
   */
  async buildDeprioritizationContext(agentName: string): Promise<string> {
    const state = await this.memoryStore.load(agentName)

    const rejectionEntries = state.entries.filter((e) => e.type === 'rejection')

    if (rejectionEntries.length === 0) {
      return ''
    }

    // Parse rejection patterns from memory entries
    const patterns: RejectionPattern[] = []
    for (const entry of rejectionEntries) {
      try {
        const parsed = JSON.parse(entry.content) as RejectionPattern
        patterns.push(parsed)
      } catch {
        // Skip corrupted entries silently
      }
    }

    if (patterns.length === 0) {
      return ''
    }

    // Group similar rejections by keyword overlap
    const groups = this.groupSimilarPatterns(patterns)

    // Build formatted context
    const lines: string[] = [
      '## Previously Rejected Content Angles',
      '',
      'DO NOT suggest content related to these previously rejected angles.',
      'Use pattern matching: avoid similar topics, not just exact matches.',
      '',
    ]

    let index = 1
    for (const group of groups) {
      // Use the first (most representative) pattern in each group
      const representative = group[0]
      const date = representative.timestamp.split('T')[0]
      lines.push(
        `${index}. "${representative.rejectedAngle}" — Reason: ${representative.rejectionReason} (rejected ${date})`,
      )
      index++
    }

    return lines.join('\n')
  }

  /**
   * Group patterns by keyword similarity.
   * Patterns with Jaccard similarity >= 50% are placed in the same group.
   * Returns array of groups — each group is an array of similar patterns.
   */
  private groupSimilarPatterns(patterns: RejectionPattern[]): RejectionPattern[][] {
    const groups: RejectionPattern[][] = []
    const assigned = new Set<number>()

    for (let i = 0; i < patterns.length; i++) {
      if (assigned.has(i)) continue

      const group: RejectionPattern[] = [patterns[i]]
      assigned.add(i)

      for (let j = i + 1; j < patterns.length; j++) {
        if (assigned.has(j)) continue

        const similarity = calculateSimilarity(
          patterns[i].keywords,
          patterns[j].keywords,
        )

        if (similarity >= 0.5) {
          group.push(patterns[j])
          assigned.add(j)
        }
      }

      groups.push(group)
    }

    return groups
  }
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 * Returns intersection.length / union.length (0.0 to 1.0).
 * Returns 0.0 for two empty sets.
 */
export function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  if (set1.size === 0 && set2.size === 0) {
    return 0.0
  }

  let intersectionSize = 0
  for (const item of set1) {
    if (set2.has(item)) {
      intersectionSize++
    }
  }

  const unionSize = new Set([...set1, ...set2]).size

  return intersectionSize / unionSize
}
