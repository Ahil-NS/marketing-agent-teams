import type {AgentResult} from '../agents/types.js'
import type {MATError} from '../utils/errors.js'

// ============================================================
// Pipeline Stage Types (shared across orchestrator layer)
// ============================================================

export type PipelineStage =
  | 'research'
  | 'strategy'
  | 'creation'
  | 'optimization'
  | 'quality'
  | 'review'
  | 'distribution'

/**
 * Ordered pipeline stages. The pipeline executes these sequentially.
 * The 'review' stage triggers an automatic pause for human review.
 */
export const PIPELINE_STAGES = Object.freeze([
  'research',
  'strategy',
  'creation',
  'optimization',
  'quality',
  'review',
  'distribution',
] as const)

export const REVIEW_STAGE: PipelineStage = 'review'

/**
 * Pipeline stages for derivative content runs.
 * Derivatives skip research and strategy (context comes from original).
 * They stop at review (no auto-distribution for derivatives).
 */
export const DERIVATIVE_PIPELINE_STAGES = Object.freeze([
  'creation',
  'optimization',
  'quality',
  'review',
] as const)

/**
 * Maps each pipeline stage to the agent names that execute within it.
 * Agents within a stage run in parallel (FR63).
 * The 'review' stage is a pause point — no agents, human review only.
 */
export const STAGE_AGENT_MAP: Record<PipelineStage, readonly string[]> = {
  research: ['trend-scout', 'audience-researcher', 'competitor-analyst', 'viral-pattern-decoder', 'platform-algorithm'],
  strategy: ['content-strategist', 'campaign-planner', 'channel-optimizer'],
  creation: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'hook-writer', 'content-atomizer'],
  optimization: ['seo-optimizer', 'ab-test-designer', 'timing-optimizer', 'content-humanizer', 'hashtag-strategist'],
  quality: ['brand-guardian', 'fact-checker', 'platform-compliance', 'sensitivity-reviewer'],
  review: [], // Human review — pipeline pauses, no agent execution
  distribution: ['reddit-publisher', 'tiktok-publisher', 'facebook-publisher', 'instagram-publisher'],
} as const

// ============================================================
// Stage Execution Types (used by StageRunner — Story 2.2)
// ============================================================

export type StageExecutionStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'skipped'

export interface StageAgentResult {
  agentName: string
  status: 'success' | 'failed'
  result: AgentResult | null
  error: MATError | null
  duration: number // milliseconds
}

export interface StageExecutionResult {
  stage: PipelineStage
  status: StageExecutionStatus
  agentResults: Record<string, StageAgentResult>
  startedAt: string // ISO 8601
  completedAt: string // ISO 8601
  errors: MATError[]
}

// --- Stage Runner Context (what the StageRunner needs from the pipeline) ---

export interface StageRunnerContext {
  config: {
    platforms: string[]
    dryRun: boolean
    enabledAgents?: string[] // Subset of agents to run (FR49)
    workflowMode?: WorkflowMode
    /** Number of content items to produce per platform. 1 = focused agent set. */
    postsPerPlatform?: number
  }
  stageResults: Partial<Record<PipelineStage, StageExecutionResult>>
  /** Brand context content for prepending to agent prompts */
  brandContext?: string
  /** Video/content context for ECT (optimize) workflow */
  optimizeContext?: OptimizeInput
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
  agentTimeoutMs: 600_000,
  continueOnFailure: true,
}

// --- Stage Configuration ---

export interface StageConfig {
  stage: PipelineStage
  agents: readonly string[]
  options?: StageRunnerOptions
}

// ============================================================
// Pipeline State Machine Types (Story 2.4)
// ============================================================

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

export type PipelineRunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface StageResult {
  status: StageStatus
  agentResults: Record<string, unknown> // Typed per-agent in Story 2.2
  startedAt?: string // ISO 8601
  completedAt?: string // ISO 8601
  error?: PipelineError
}

export interface PipelineError {
  stage: PipelineStage
  code: string
  message: string
  reason: string
  resolution: string
  severity: 'transient' | 'permanent'
  timestamp: string // ISO 8601
}

export interface PipelineRun {
  id: string
  status: PipelineRunStatus
  currentStage: PipelineStage
  stages: Record<PipelineStage, StageResult>
  budget: {
    spent: number
    limit: number
    currency: 'USD'
    dailySpent: number
    dailyLimit: number
  }
  config: {
    platforms: string[]
    dryRun: boolean
  }
  errors: PipelineError[]
  startedAt: string // ISO 8601
  updatedAt: string // ISO 8601
  completedAt?: string // ISO 8601
}

/**
 * Represents a state transition event for logging/auditing.
 */
export interface StageTransition {
  from: PipelineStage
  to: PipelineStage
  fromStatus: StageStatus
  toStatus: StageStatus
  timestamp: string // ISO 8601
}

// ============================================================
// Orchestrator Types (Story 2.5)
// ============================================================

export interface OptimizeInput {
  videoPath: string
  platform: 'tiktok' | 'instagram' | 'facebook'
  topic: string
  niche?: string
  audience?: string
  description?: string
  duration?: string
}

export interface OrchestratorConfig {
  platforms: string[]
  dryRun: boolean
  budgetLimit: number
  disabledAgents: string[]
  projectRoot: string
  /** Brand context content from .mat/context/product-marketing-context.md */
  brandContext?: string
  /** Active stages for flexible workflows (default: all 7 stages) */
  activeStages?: PipelineStage[]
  /** Workflow mode for agent selection (e.g., 'optimize' uses ECT agent set) */
  workflowMode?: WorkflowMode
  /** Video/content context for ECT (optimize) workflow */
  optimizeContext?: OptimizeInput
  /** Number of content items per platform. 1 = focused (fewer agents). Default: 1 */
  postsPerPlatform?: number
}

export type WorkflowMode = 'full' | 'brief' | 'idea' | 'single' | 'optimize'

export interface OrchestratorEvents {
  onStageStart?: (stage: PipelineStage) => void
  onStageComplete?: (stage: PipelineStage, result: StageExecutionResult) => void
  onAgentFailed?: (agentName: string, error: Error) => void
  onPipelinePaused?: (stage: PipelineStage) => void
  onViralDetected?: (itemId: string, platform: string) => void
}

export type OrchestratorEventType =
  | 'stage:start'
  | 'stage:complete'
  | 'agent:failed'
  | 'pipeline:paused'
  | 'pipeline:completed'
  | 'pipeline:failed'

export interface OrchestratorEventData {
  type: OrchestratorEventType
  stage?: PipelineStage
  result?: StageExecutionResult
  agentName?: string
  error?: string
  runId?: string
  timestamp: string
}

// ============================================================
// Budget Tracking Types (Story 2.6)
// ============================================================

/** Budget configuration from .mat/config.yaml or pipeline options. */
export interface BudgetConfig {
  /** Max USD to spend per pipeline run. null = no limit. */
  perRunLimit?: number | null
  /** Max USD to spend per calendar day across all runs. null = no limit. */
  perDayLimit?: number | null
}

/** Serializable budget state for PipelineRun.budget. */
export interface BudgetState {
  spent: number
  limit: number
  currency: 'USD'
  dailySpent: number
  dailyLimit: number
}

/** Result of a budget check after recording cost. */
export interface BudgetCheckResult {
  exceeded: boolean
  type: 'per-run' | 'per-day' | null
  /**
   * The spend amount scoped to whichever `type` was exceeded.
   * When `type === 'per-run'`, this is the run spend.
   * When `type === 'per-day'`, this is the daily spend.
   * When `type === null` (not exceeded), this is the run spend.
   */
  spent: number
  /**
   * The limit that was exceeded (matches scope of `spent`).
   * When `type === null`, falls back to perRunLimit, perDayLimit, or null.
   */
  limit: number | null
  remaining: number | null
}

/** Daily budget state persisted to .mat/state/budget.json. */
export interface DailyBudgetState {
  date: string // ISO date: '2026-02-28'
  spent: number
  entries: DailyBudgetEntry[]
}

/** Individual cost entry in the daily budget ledger. */
export interface DailyBudgetEntry {
  agentName: string
  cost: number
  timestamp: string // ISO datetime
}
