import {z} from 'zod'

import {executeAgent} from '../agents/agent-executor.js'
import {AgentTimeoutError} from '../agents/errors.js'
import {resolveAgentDir} from '../agents/skill-loader.js'
import {loadSkill} from '../agents/skill-loader.js'
import type {AgentExecutor} from '../agent-executor/index.js'
import {createExecutor} from '../agent-executor/executor-factory.js'
import type {MATError} from '../utils/errors.js'

import {resolveInputs} from './input-resolver.js'
import type {
  AgentAssignment,
  OptimizeInput,
  PipelineStage,
  StageAgentResult,
  StageExecutionResult,
  StageRunnerContext,
  StageRunnerOptions,
} from './types.js'
import {
  DEFAULT_STAGE_RUNNER_OPTIONS,
  STAGE_AGENT_MAP,
} from './types.js'

/**
 * Reduced agent set for ECT (optimize) workflow.
 * Only runs agents relevant to optimizing existing content metadata.
 */
const ECT_STAGE_AGENTS: Partial<Record<PipelineStage, readonly string[]>> = {
  research: ['trend-scout', 'platform-algorithm'],
  optimization: ['seo-optimizer', 'hashtag-strategist', 'timing-optimizer'],
  // distribution uses platform filtering from STAGE_AGENT_MAP
}

/**
 * Focused agent set for single-post workflows (postsPerPlatform === 1).
 * Cuts redundant agents that add time without value for a single content piece.
 * Creation stage is handled dynamically (only platform-prefixed creators).
 */
const FOCUSED_STAGE_AGENTS: Partial<Record<PipelineStage, readonly string[]>> = {
  research: ['trend-scout', 'platform-algorithm'],
  strategy: ['content-strategist'],
  optimization: ['seo-optimizer', 'hashtag-strategist', 'timing-optimizer'],
  quality: ['brand-guardian', 'platform-compliance'],
}

export class StageRunner {
  private readonly options: Required<StageRunnerOptions>
  private readonly executor: AgentExecutor

  constructor(options?: StageRunnerOptions & {executor?: AgentExecutor}) {
    const {executor, ...runnerOptions} = options ?? {}
    this.options = {...DEFAULT_STAGE_RUNNER_OPTIONS, ...runnerOptions}
    this.executor = executor ?? createExecutor('auto')
  }

  /**
   * Execute all agents for a given pipeline stage.
   *
   * Agents within a stage run in parallel via Promise.allSettled() (FR63).
   * If some agents fail, the stage completes in degraded mode (FR3, NFR14).
   * If ALL agents fail, the stage is marked as failed.
   *
   * ## Attribution Contract (FR28 — Story 4.6)
   *
   * After each agent completes, the stage-runner should build an attribution
   * entry from the AgentResult and append it to the relevant content item's
   * attribution chain:
   *
   * ```typescript
   * import { buildAttributionEntry, appendToAttributionChain } from '../agents/index.js'
   *
   * // After agent execution:
   * const entry = buildAttributionEntry(agentResult, stage, runId)
   * contentItem.attribution.attributionChain = appendToAttributionChain(
   *   contentItem.attribution.attributionChain,
   *   entry,
   * )
   * ```
   *
   * This wiring will be implemented when ContentItem is fully integrated
   * into the pipeline state. The utility functions are available now.
   */
  async runStage(
    stage: PipelineStage,
    pipelineRun: StageRunnerContext,
  ): Promise<StageExecutionResult> {
    const startedAt = new Date().toISOString()
    const agentNames = this.getAgentsForStage(stage, pipelineRun)

    if (agentNames.length === 0) {
      return {
        stage,
        status: 'skipped',
        agentResults: {},
        startedAt,
        completedAt: new Date().toISOString(),
        errors: [],
      }
    }

    const assignments = this.buildAssignments(stage, agentNames, pipelineRun)
    const agentResults = await this.executeAgentsInParallel(assignments)

    const completedAt = new Date().toISOString()
    const errors = this.collectErrors(agentResults)
    let status = this.determineStageStatus(agentResults)

    // When continueOnFailure is false, treat partial success as full failure.
    // All agents still run (NFR14), but the stage is reported as failed.
    if (!this.options.continueOnFailure && status === 'partial') {
      status = 'failed'
    }

    return {
      stage,
      status,
      agentResults: this.toAgentResultRecord(agentResults),
      startedAt,
      completedAt,
      errors,
    }
  }

  /**
   * Determine which agents to run for a stage.
   * Filters platform-specific agents by selected platforms,
   * and respects enabledAgents config (FR49).
   */
  private getAgentsForStage(
    stage: PipelineStage,
    pipelineRun: StageRunnerContext,
  ): string[] {
    const mode = pipelineRun.config.workflowMode
    const isFocused = (pipelineRun.config.postsPerPlatform ?? 1) <= 1

    // Pick the right agent map: ECT > focused > full
    let baseAgents: readonly string[] | undefined
    if (mode === 'optimize') {
      baseAgents = ECT_STAGE_AGENTS[stage]
    } else if (isFocused) {
      baseAgents = FOCUSED_STAGE_AGENTS[stage]
    }
    let agents = [...(baseAgents ?? STAGE_AGENT_MAP[stage])]
    const platforms = pipelineRun.config.platforms

    // Filter platform-specific agents (creator/publisher) to only selected platforms
    if (platforms.length > 0) {
      agents = agents.filter((agent) => {
        const platformMatch = agent.match(/^(reddit|tiktok|facebook|instagram)-/)
        if (!platformMatch) return true // non-platform agents always run
        return platforms.includes(platformMatch[1])
      })
    }

    // In focused mode, creation stage only runs platform-prefixed creators
    // (skip hook-writer, content-atomizer which aren't platform-prefixed)
    if (isFocused && stage === 'creation' && mode !== 'optimize') {
      agents = agents.filter((agent) => agent.match(/^(reddit|tiktok|facebook|instagram)-/))
    }

    const enabledAgents = pipelineRun.config.enabledAgents
    if (enabledAgents && enabledAgents.length > 0) {
      agents = agents.filter((agent) => enabledAgents.includes(agent))
    }

    return agents
  }

  /**
   * Build agent assignments with resolved inputs from upstream stages.
   */
  private buildAssignments(
    stage: PipelineStage,
    agentNames: string[],
    pipelineRun: StageRunnerContext,
  ): AgentAssignment[] {
    const resolvedInputs = resolveInputs(stage, pipelineRun.stageResults)

    // Research stage has no upstream — inject pipeline config as inputs
    if (stage === 'research' && Object.keys(resolvedInputs).length === 0) {
      resolvedInputs.platforms = pipelineRun.config.platforms
      resolvedInputs.dryRun = pipelineRun.config.dryRun
    }

    // Inject brand context if available
    if (pipelineRun.brandContext) {
      resolvedInputs.brandContext = pipelineRun.brandContext
    }

    // Inject optimize context for ECT workflow
    if (pipelineRun.optimizeContext) {
      resolvedInputs.optimizeContext = pipelineRun.optimizeContext
    }

    return agentNames.map((agentName) => ({
      agentName,
      stage,
      inputs: resolvedInputs,
    }))
  }

  /**
   * Execute agents in parallel using Promise.allSettled().
   *
   * Promise.allSettled() ensures ALL agents are awaited even if some reject.
   * This is critical for degraded mode (FR3, NFR14).
   */
  private async executeAgentsInParallel(
    assignments: AgentAssignment[],
  ): Promise<StageAgentResult[]> {
    const {concurrencyLimit} = this.options

    // If no concurrency limit or limit exceeds assignment count, run all at once
    if (!Number.isFinite(concurrencyLimit) || concurrencyLimit >= assignments.length) {
      return this.settleAgentBatch(assignments)
    }

    // Batch execution respecting concurrency limit
    const results: StageAgentResult[] = []
    for (let i = 0; i < assignments.length; i += concurrencyLimit) {
      const batch = assignments.slice(i, i + concurrencyLimit)
      const batchResults = await this.settleAgentBatch(batch)
      results.push(...batchResults)
    }
    return results
  }

  /**
   * Execute a batch of agents via Promise.allSettled().
   * Always waits for ALL agents in the batch to complete (FR3, NFR14).
   */
  private async settleAgentBatch(
    assignments: AgentAssignment[],
  ): Promise<StageAgentResult[]> {
    const promises = assignments.map((assignment) =>
      this.executeWithTimeout(assignment),
    )

    const settled = await Promise.allSettled(promises)

    return settled.map((outcome, index) => {
      const {agentName} = assignments[index]

      if (outcome.status === 'fulfilled') {
        return outcome.value
      }

      const error = outcome.reason instanceof Error
        ? outcome.reason
        : new Error(String(outcome.reason))

      return {
        agentName,
        status: 'failed' as const,
        result: null,
        error: error as MATError,
        duration: 0,
      }
    })
  }

  /**
   * Execute a single agent with a timeout wrapper.
   */
  private async executeWithTimeout(
    assignment: AgentAssignment,
  ): Promise<StageAgentResult> {
    const startTime = Date.now()

    // Load SKILL.md for agent (systemPrompt, tools, model)
    let systemPrompt = ''
    let allowedTools: string[] = []
    let model: 'haiku' | 'sonnet' = 'haiku'
    try {
      const agentDir = await resolveAgentDir(assignment.agentName)
      const skill = await loadSkill(agentDir)
      systemPrompt = skill.systemPrompt
      if (skill.knowledgeContext) {
        systemPrompt += '\n\n---\n\n' + skill.knowledgeContext
      }
      allowedTools = skill.tools ?? []
      model = skill.model ?? 'haiku'
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return {
        agentName: assignment.agentName,
        status: 'failed' as const,
        result: null,
        error: new Error(`Skill load failed for "${assignment.agentName}": ${reason}`) as MATError,
        duration: Date.now() - startTime,
      }
    }

    const agentPromise = executeAgent(assignment.agentName, {
      prompt: buildAgentPrompt(assignment.agentName, assignment.inputs),
      systemPrompt,
      allowedTools,
      model,
      maxTurns: 10,
      outputSchema: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
    }, this.executor)

    let timeoutId: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new AgentTimeoutError(assignment.agentName, `Exceeded ${this.options.agentTimeoutMs}ms timeout`)),
        this.options.agentTimeoutMs,
      )
    })

    try {
      const result = await Promise.race([agentPromise, timeoutPromise])
      return {
        agentName: assignment.agentName,
        status: 'success',
        result,
        error: null,
        duration: Date.now() - startTime,
      }
    } finally {
      clearTimeout(timeoutId!)
    }
  }

  /**
   * Determine overall stage status from individual agent results.
   */
  private determineStageStatus(
    results: StageAgentResult[],
  ): 'completed' | 'partial' | 'failed' {
    const successCount = results.filter((r) => r.status === 'success').length
    const totalCount = results.length

    if (successCount === totalCount) return 'completed'
    if (successCount > 0) return 'partial'
    return 'failed'
  }

  /**
   * Collect all errors from agent results into a flat array.
   */
  private collectErrors(results: StageAgentResult[]): MATError[] {
    return results
      .filter((r) => r.error !== null)
      .map((r) => r.error!)
  }

  /**
   * Convert StageAgentResult array to a Record keyed by agent name.
   */
  private toAgentResultRecord(
    results: StageAgentResult[],
  ): Record<string, StageAgentResult> {
    const record: Record<string, StageAgentResult> = {}
    for (const result of results) {
      record[result.agentName] = result
    }
    return record
  }
}

/**
 * Build an explicit task prompt for an agent so it executes immediately
 * rather than responding conversationally.
 */
function buildAgentPrompt(
  _agentName: string,
  inputs: Record<string, unknown>,
): string {
  const optimizeCtx = inputs.optimizeContext as OptimizeInput | undefined

  if (optimizeCtx) {
    const upstreamLines = Object.entries(inputs)
      .filter(([k]) => k !== 'optimizeContext')
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n')

    return `You are optimizing metadata for an EXISTING ${optimizeCtx.platform} video (not creating new content).

Video details:
- Platform: ${optimizeCtx.platform}
- Topic: ${optimizeCtx.topic}
${optimizeCtx.niche ? `- Niche: ${optimizeCtx.niche}` : ''}
${optimizeCtx.audience ? `- Target audience: ${optimizeCtx.audience}` : ''}
${optimizeCtx.description ? `- Description: ${optimizeCtx.description}` : ''}
${optimizeCtx.duration ? `- Duration: ${optimizeCtx.duration}` : ''}

Focus ONLY on: SEO keywords, caption text, hashtags, posting time, trending sounds to pair with.
Do NOT generate video scripts, Veo 3 prompts, or new content.

Upstream data:
${upstreamLines}

Respond with ONLY valid JSON.`
  }

  const inputLines = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')

  return `Execute your task now with the following inputs:\n\n${inputLines}\n\nRespond with ONLY valid JSON. Do not include markdown, explanations, or any text outside the JSON object.`
}
