import type {AgentResult} from '../agents/types.js'
import type {MATError} from '../utils/errors.js'

// --- Pipeline Stage Types ---

export type PipelineStage =
  | 'research'
  | 'strategy'
  | 'creation'
  | 'optimization'
  | 'quality'
  | 'review'
  | 'distribution'

export const PIPELINE_STAGES: readonly PipelineStage[] = Object.freeze([
  'research',
  'strategy',
  'creation',
  'optimization',
  'quality',
  'review',
  'distribution',
] as const)

/**
 * Maps each pipeline stage to the agent names that execute within it.
 * Agents within a stage run in parallel (FR63).
 * The 'review' stage is a pause point — no agents, human review only.
 */
export const STAGE_AGENT_MAP: Record<PipelineStage, readonly string[]> = {
  research: ['trend-scout', 'audience-researcher', 'competitor-analyst'],
  strategy: ['content-strategist', 'campaign-planner', 'channel-optimizer'],
  creation: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'hook-writer'],
  optimization: ['seo-optimizer', 'ab-test-designer', 'timing-optimizer', 'hashtag-strategist'],
  quality: ['brand-guardian', 'fact-checker', 'platform-compliance', 'sensitivity-reviewer'],
  review: [], // Human review — pipeline pauses, no agent execution
  distribution: ['reddit-publisher', 'tiktok-publisher', 'facebook-publisher', 'instagram-publisher'],
} as const

// --- Stage Result Types ---

export type StageStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'skipped'

export interface StageAgentResult {
  agentName: string
  status: 'success' | 'failed'
  result: AgentResult | null
  error: MATError | null
  duration: number // milliseconds
}

export interface StageResult {
  stage: PipelineStage
  status: StageStatus
  agentResults: Record<string, StageAgentResult>
  startedAt: string // ISO 8601
  completedAt: string // ISO 8601
  errors: MATError[]
}

// --- Pipeline Run Types (minimal contract for stage runner — full impl in Story 2.4) ---

export interface PipelineRun {
  id: string
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  currentStage: PipelineStage
  stageResults: Partial<Record<PipelineStage, StageResult>>
  config: {
    platforms: string[]
    dryRun: boolean
    enabledAgents?: string[] // Subset of agents to run (FR49)
  }
  budget: {
    spent: number
    limit: number
    currency: 'USD'
  }
  startedAt: string
  updatedAt: string
  errors: MATError[]
}

// --- Agent Assignment Types ---

export interface AgentAssignment {
  agentName: string
  stage: PipelineStage
  inputs: Record<string, unknown> // Resolved from upstream stage outputs
}

// --- Stage Runner Options ---

export interface StageRunnerOptions {
  /** Maximum concurrent agent executions per stage. Default: Infinity (all parallel) */
  concurrencyLimit?: number
  /** Per-agent timeout in milliseconds. Default: 300_000 (5 min, NFR5) */
  agentTimeoutMs?: number
  /** Whether to continue executing agents after one fails. Default: true (FR3, NFR14) */
  continueOnFailure?: boolean
}

export const DEFAULT_STAGE_RUNNER_OPTIONS: Required<StageRunnerOptions> = {
  concurrencyLimit: Infinity,
  agentTimeoutMs: 300_000,
  continueOnFailure: true,
}

// --- Stage Configuration ---

export interface StageConfig {
  stage: PipelineStage
  agents: readonly string[]
  options?: StageRunnerOptions
}
