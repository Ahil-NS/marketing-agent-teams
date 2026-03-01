import {randomUUID} from 'node:crypto'

import type {AgentMemoryStore} from './memory-store.js'

/**
 * English stop words filtered during keyword extraction.
 * These add no semantic value for pattern matching.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'and', 'but', 'or', 'if', 'this', 'that',
  'these', 'those', 'it', 'its',
])

export interface RecordRejectionParams {
  contentItemId: string
  rejectedAngle: string
  rejectionReason: string
  agentName: string
}

/**
 * Records content rejections into agent memory.
 * Extracts keywords from rejected angles for similarity-based deprioritization.
 *
 * Data flow: Review queue → recordRejection() → AgentMemoryStore → Deprioritizer
 */
export class RejectionRecorder {
  private readonly memoryStore: AgentMemoryStore

  constructor(memoryStore: AgentMemoryStore) {
    this.memoryStore = memoryStore
  }

  /**
   * Record a content rejection into the agent's memory.
   * Extracts keywords from the rejected angle and reason,
   * then persists as a MemoryEntry with type: 'rejection'.
   */
  async recordRejection(params: RecordRejectionParams): Promise<void> {
    const keywords = extractKeywords(`${params.rejectedAngle} ${params.rejectionReason}`)

    const rejectionData = {
      id: randomUUID(),
      contentItemId: params.contentItemId,
      rejectedAngle: params.rejectedAngle,
      rejectionReason: params.rejectionReason,
      agentName: params.agentName,
      timestamp: new Date().toISOString(),
      keywords,
      confidence: 1.0,
    }

    await this.memoryStore.addEntry(params.agentName, {
      runId: `rejection-${rejectionData.id}`,
      type: 'rejection',
      content: JSON.stringify(rejectionData),
      source: 'review-queue',
      confidence: 1.0,
    })
  }
}

/**
 * Extract keywords from text for pattern matching.
 * Splits on whitespace and punctuation, filters stop words,
 * lowercases, deduplicates, and removes tokens shorter than 3 characters.
 *
 * This is a pure synchronous string operation — no I/O, no NLP.
 */
export function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token))

  return [...new Set(tokens)]
}
