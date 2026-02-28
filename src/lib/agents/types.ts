import type {MATError} from '../utils/errors.js'

export interface AgentResult<T = unknown> {
  agentName: string
  runId: string
  status: 'success' | 'partial' | 'failed'
  outputs: T
  usage: {
    inputTokens: number
    outputTokens: number
    cost: number
  }
  duration: number
  errors: MATError[]
}

export interface AgentInputs {
  brandName: string
  productDomain: string
}

export interface ResearchInputs extends AgentInputs {
  audienceType: string
  platforms: string[]
  trendTimeframeDays?: number
}

/** Parsed SKILL.md definition — returned by skill-loader (Story 2.9) */
export interface SkillDefinition {
  /** Agent name in kebab-case — must match directory name */
  name: string
  /** Multi-line description of agent role and capabilities */
  description: string
  /** Cluster this agent belongs to */
  cluster: 'intelligence' | 'strategy' | 'creation' | 'optimization' | 'quality' | 'distribution' | 'coordination'
  /** Model selection — haiku for research/fast, sonnet for creative/complex */
  model: 'haiku' | 'sonnet'
  /** Allowed SDK tools — security boundary for agent execution */
  tools: string[]
  /** Trust tier — determines credential access and publishing capability */
  trustTier: 'builtin' | 'reviewed' | 'unreviewed'
  /** Full SKILL.md content (YAML front matter stripped) used as system prompt */
  systemPrompt: string
  /** Concatenated knowledge/ file contents — injected into system prompt */
  knowledgeContext: string
  /** Template name -> template content map from templates/ directory */
  templates: Record<string, string>
}

/** A single memory entry stored by the agent memory system */
export interface MemoryEntry {
  /** Unique ID for this memory entry (UUID) */
  id: string
  /** Pipeline run ID that produced this entry */
  runId: string
  /** ISO 8601 timestamp of when this entry was created */
  timestamp: string
  /** Classification of memory type */
  type: 'learning' | 'rejection' | 'pattern' | 'preference'
  /** Human-readable description of the memory */
  content: string
  /** What produced this memory (e.g., 'human-review', 'quality-gate', 'agent-self') */
  source: string
  /** Confidence score 0-1 (higher = more reliable) */
  confidence: number
}

/** Persistent memory state for a single agent */
export interface AgentMemoryState {
  /** Agent name this memory belongs to */
  agentName: string
  /** Last pipeline run ID that wrote to this memory */
  lastRunId: string | null
  /** ISO 8601 timestamp of last memory update */
  lastRunAt: string | null
  /** Ordered list of memory entries (newest last) */
  entries: MemoryEntry[]
  /** Extensible metadata (agent-specific key-value pairs) */
  metadata: Record<string, unknown>
}

/** Options for configuring agent memory behavior */
export interface AgentMemoryOptions {
  /** Maximum number of memory entries to retain (default: 100) */
  maxEntries?: number
  /** Number of days to retain memory entries (default: 90) */
  retentionDays?: number
  /** Whether memory persistence is enabled for this agent (default: true) */
  memoryEnabled?: boolean
}
