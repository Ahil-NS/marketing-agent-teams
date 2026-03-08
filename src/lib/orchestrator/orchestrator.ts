import {randomUUID} from 'node:crypto'

import {createLogger} from '../logging/logger.js'
import type {Logger} from '../logging/logger.js'
import {ContextManager} from '../context/context-manager.js'
import {sseEmitter} from '../dashboard/sse-emitter.js'
import {CampaignStore} from '../history/campaign-store.js'
import {ReviewQueue} from '../review-queue/review-queue.js'
import type {ReviewItem} from '../review-queue/types.js'

import {
  AllAgentsFailedError,
  PipelineExecutionError,
} from './errors.js'
import {PipelineStateMachine} from './pipeline-state.js'
import type {StageRunner} from './stage-runner.js'
import type {
  OrchestratorConfig,
  OrchestratorEvents,
  PipelineRun,
  PipelineStage,
  StageAgentResult,
  StageExecutionResult,
  StageRunnerContext,
} from './types.js'
import {PIPELINE_STAGES, STAGE_AGENT_MAP} from './types.js'

/**
 * Orchestrates the full marketing pipeline: sequences stages,
 * coordinates agent execution, handles degraded mode, and
 * manages pipeline lifecycle (create, resume, pause, complete).
 *
 * The Orchestrator is the Orchestration Layer's entry point.
 * It delegates agent execution to StageRunner (Story 2.2) and
 * state management to PipelineStateMachine (Story 2.4).
 */
export class Orchestrator {
  /**
   * Typed stage execution results maintained across the pipeline run.
   * Used for downstream input resolution — StageRunner.runStage() needs
   * upstream StageExecutionResult objects to resolve agent inputs.
   */
  private stageResults: Partial<Record<PipelineStage, StageExecutionResult>> = {}
  private logger: Logger | undefined

  constructor(
    private readonly config: OrchestratorConfig,
    private readonly stageRunner: StageRunner,
    private readonly stateMachine: PipelineStateMachine,
    private readonly events?: OrchestratorEvents,
  ) {}

  /**
   * Creates a new pipeline run and returns an Orchestrator ready to execute.
   */
  static async create(
    config: OrchestratorConfig,
    stageRunner: StageRunner,
    events?: OrchestratorEvents,
  ): Promise<Orchestrator> {
    const sm = await PipelineStateMachine.create(
      {platforms: config.platforms, dryRun: config.dryRun, activeStages: config.activeStages},
      {limit: config.budgetLimit},
      config.projectRoot,
    )
    // Load brand context if available
    const contextManager = new ContextManager(config.projectRoot)
    const brandContext = await contextManager.getContext()
    if (brandContext) {
      config = {...config, brandContext}
    }

    const orchestrator = new Orchestrator(config, stageRunner, sm, events)
    const matDir = `${config.projectRoot}/.mat`
    orchestrator.logger = await createLogger({matDir, runId: sm.getRunId()})
    await orchestrator.logger.info('orchestrator', `Pipeline created: ${sm.getRunId()}`, {
      platforms: config.platforms, dryRun: config.dryRun, budgetLimit: config.budgetLimit,
      hasBrandContext: !!brandContext,
    })
    return orchestrator
  }

  /**
   * Resumes a paused or failed pipeline run from its last state.
   * - Paused pipelines (at review): unpause and continue from the review stage
   * - Failed pipelines: retry from the failed stage
   */
  static async resume(
    runId: string,
    config: OrchestratorConfig,
    stageRunner: StageRunner,
    events?: OrchestratorEvents,
  ): Promise<Orchestrator> {
    const sm = await PipelineStateMachine.resume(runId, config.projectRoot)
    const state = sm.getState()

    if (state.status === 'paused') {
      await sm.unpause()
    } else if (state.status === 'failed') {
      await sm.retry()
    }

    const orchestrator = new Orchestrator(config, stageRunner, sm, events)
    const matDir = `${config.projectRoot}/.mat`
    orchestrator.logger = await createLogger({matDir, runId: sm.getRunId()})
    await orchestrator.logger.info('orchestrator', `Pipeline resumed: ${sm.getRunId()}`)
    orchestrator.restoreStageResults(state)
    return orchestrator
  }

  /**
   * Main entry point: executes the pipeline from its current state
   * through to completion, pausing at the review stage for human review.
   *
   * Returns the final PipelineRun state.
   */
  async execute(): Promise<PipelineRun> {
    while (true) {
      const state = this.stateMachine.getState()

      // Terminal states — stop execution
      if (state.status === 'completed' || state.status === 'cancelled') {
        break
      }

      // Paused (e.g., at review after auto-pause from transition)
      if (state.status === 'paused') {
        this.events?.onPipelinePaused?.(state.currentStage)
        break
      }

      // Failed — should not happen mid-loop since we throw on failure
      if (state.status === 'failed') {
        break
      }

      const stage = state.currentStage
      const stageState = state.stages[stage]

      // Review stage: transition past it to distribution
      // When quality transitions, the state machine auto-pauses at review.
      // On fresh runs this code is never reached (we break on 'paused' above).
      // On resume, unpause() resets review to 'pending', so we transition through it.
      if (stage === 'review') {
        await this.stateMachine.startStage()
        await this.stateMachine.transition({})
        // After transitioning from review, continue the loop
        // (distribution stage will be next)
        continue
      }

      // Distribution stage in dry-run mode: skip
      if (stage === 'distribution' && this.config.dryRun) {
        await this.stateMachine.startStage()
        await this.stateMachine.transition({})
        continue
      }

      // Skip stages pre-marked as completed (not in activeStages for this workflow)
      if (stageState.status === 'completed') {
        await this.logger?.info('orchestrator', `Skipping inactive stage: ${stage}`)
        await this.stateMachine.skipCompletedStage()
        continue
      }

      // Start the stage (pending -> running)
      if (stageState.status === 'pending') {
        await this.stateMachine.startStage()
      }

      this.events?.onStageStart?.(stage)
      sseEmitter.broadcast({type: 'stage:start', stage, runId: this.getRunId(), timestamp: new Date().toISOString()})
      await this.logger?.info('orchestrator', `Stage started: ${stage}`)

      // Build context for stage runner
      const context = this.buildStageRunnerContext()

      // Execute the stage
      const executionResult = await this.stageRunner.runStage(stage, context)

      // Store typed results for downstream input resolution
      this.stageResults[stage] = executionResult
      await this.logger?.info('orchestrator', `Stage completed: ${stage} (${executionResult.status})`, {
        agentCount: Object.keys(executionResult.agentResults).length,
        errors: executionResult.errors.length,
      })

      // Log individual agent errors for diagnostics
      for (const agentResult of Object.values(executionResult.agentResults)) {
        if (agentResult.status === 'failed' && agentResult.error) {
          await this.logger?.error('orchestrator', `Agent '${agentResult.agentName}' failed: ${agentResult.error.message}`, {
            agent: agentResult.agentName,
            duration: agentResult.duration,
            error: agentResult.error.message,
          })
        }
      }

      // All agents failed: pipeline cannot continue
      if (executionResult.status === 'failed') {
        await this.logger?.error('orchestrator', `All agents in stage '${stage}' failed`)
        const runId = this.stateMachine.getRunId()
        await this.stateMachine.fail({
          code: 'STAGE_ALL_AGENTS_FAILED',
          message: `All agents in stage '${stage}' failed`,
          reason: `Every agent in the ${stage} stage failed, preventing downstream stages from receiving input`,
          resolution: `Check individual agent errors. Re-run with 'mat run --resume ${runId}' after resolving issues`,
          severity: 'permanent',
        })
        const agentErrors = executionResult.errors
          .map((e) => `  - ${e.message}`)
          .join('\n')
        throw new AllAgentsFailedError(
          `All agents in stage '${stage}' failed`,
          'STAGE_ALL_AGENTS_FAILED',
          `Every agent in the ${stage} stage failed, preventing downstream stages from receiving input${agentErrors ? `:\n${agentErrors}` : ''}`,
          `Check individual agent errors. Re-run with 'mat run --resume ${runId}' after resolving issues`,
          'orchestrator',
          'permanent',
        )
      }

      // Skipped stage (no agents matched enabled filter)
      if (executionResult.status === 'skipped') {
        await this.stateMachine.transition({})
        continue
      }

      // Partial failure: degraded mode (FR3, NFR14)
      // Individual agent failures are persisted in agentResults via transition().
      // onStageComplete carries the full StageExecutionResult with partial status.
      if (executionResult.status === 'partial') {
        for (const agentResult of Object.values(executionResult.agentResults)) {
          if (agentResult.status === 'failed' && agentResult.error) {
            this.events?.onAgentFailed?.(agentResult.agentName, agentResult.error)
          }
        }
      }

      // Transition to next stage (or complete pipeline)
      await this.stateMachine.transition(executionResult.agentResults)

      this.events?.onStageComplete?.(stage, executionResult)
      sseEmitter.broadcast({type: 'stage:complete', stage, result: executionResult, runId: this.getRunId(), timestamp: new Date().toISOString()})

      // Budget check placeholder (Story 2.6 integrates full BudgetTracker)
      const totalCost = this.calculateTotalCost()
      if (totalCost > this.config.budgetLimit) {
        const error = new PipelineExecutionError(
          `Budget exceeded: $${totalCost.toFixed(2)} > $${this.config.budgetLimit.toFixed(2)}`,
          'PIPELINE_BUDGET_EXCEEDED',
          `Pipeline run spent $${totalCost.toFixed(2)}, exceeding the configured limit of $${this.config.budgetLimit.toFixed(2)}`,
          'Increase the budget limit in .mat/config.yaml or reduce the number of agents/platforms',
          'orchestrator',
          'permanent',
        )
        await this.stateMachine.fail({
          code: error.code,
          message: error.message,
          reason: error.reason,
          resolution: error.resolution,
          severity: error.severity,
        })
        throw error
      }

      // If pipeline completed or paused after transition, break
      const postState = this.stateMachine.getState()
      if (
        postState.status === 'completed' ||
        postState.status === 'paused'
      ) {
        // Enqueue content for review when pausing at the review stage
        if (postState.status === 'paused' && postState.currentStage === 'review') {
          await this.enqueueForReview()
        }
        if (postState.status === 'paused') {
          this.events?.onPipelinePaused?.(postState.currentStage)
        }
        break
      }
    }

    const finalState = this.stateMachine.getState()

    // Persist campaign record on completion
    if (finalState.status === 'completed' || finalState.status === 'failed') {
      try {
        const campaignStore = new CampaignStore(this.config.projectRoot)
        await campaignStore.save({
          id: finalState.id,
          name: `Campaign ${finalState.id.slice(0, 8)}`,
          platforms: this.config.platforms,
          status: finalState.status === 'completed' ? 'completed' : 'failed',
          contentCount: this.countContentItems(finalState),
          totalCost: this.calculateTotalCost(),
          startedAt: finalState.startedAt,
          completedAt: finalState.completedAt ?? new Date().toISOString(),
          config: {
            dryRun: this.config.dryRun,
            budgetLimit: this.config.budgetLimit,
          },
        })
      } catch {
        // Non-fatal: campaign history is informational
      }
    }

    return finalState
  }

  /** Returns the pipeline run ID. */
  getRunId(): string {
    return this.stateMachine.getRunId()
  }

  /** Returns a readonly snapshot of the current pipeline run state. */
  getState(): Readonly<PipelineRun> {
    return this.stateMachine.getState()
  }

  // ------- Private helpers -------

  /**
   * Builds the StageRunnerContext passed to StageRunner.runStage().
   * Converts disabledAgents to enabledAgents (positive list).
   */
  private buildStageRunnerContext(): StageRunnerContext {
    return {
      config: {
        platforms: this.config.platforms,
        dryRun: this.config.dryRun,
        enabledAgents: this.getEnabledAgents(),
        workflowMode: this.config.workflowMode,
        postsPerPlatform: this.config.postsPerPlatform,
      },
      stageResults: this.stageResults,
      brandContext: this.config.brandContext,
      optimizeContext: this.config.optimizeContext,
    }
  }

  /**
   * Converts config.disabledAgents (negative list) to enabledAgents (positive list).
   * Returns undefined if no agents are disabled (= run all agents).
   */
  private getEnabledAgents(): string[] | undefined {
    if (this.config.disabledAgents.length === 0) {
      return undefined
    }

    const allAgents = [...new Set(Object.values(STAGE_AGENT_MAP).flat())]
    return allAgents.filter((a) => !this.config.disabledAgents.includes(a))
  }

  /**
   * Calculates total cost across all completed stages.
   * Simple threshold check placeholder — Story 2.6 replaces with BudgetTracker.
   */
  private calculateTotalCost(): number {
    let total = 0
    for (const stageResult of Object.values(this.stageResults)) {
      for (const agentResult of Object.values(stageResult.agentResults)) {
        total += (agentResult as StageAgentResult).result?.usage?.cost ?? 0
      }
    }
    return total
  }

  /**
   * When resuming a pipeline, restore stageResults from completed stages
   * so downstream input resolution works. The persisted StageResult has
   * generic agentResults; we wrap them as minimal StageExecutionResult objects.
   */
  private restoreStageResults(state: PipelineRun): void {
    for (const stageName of PIPELINE_STAGES) {
      const stageResult = state.stages[stageName]
      if (stageResult.status === 'completed' && Object.keys(stageResult.agentResults).length > 0) {
        // Validate and reconstruct StageExecutionResult for input resolution.
        // The agentResults in PipelineRun.stages are persisted by transition().
        // Validate shape before casting to guard against corruption or schema drift.
        const validatedResults: Record<string, StageAgentResult> = {}
        for (const [agentName, raw] of Object.entries(stageResult.agentResults)) {
          if (this.isValidStageAgentResult(raw)) {
            validatedResults[agentName] = raw
          }
        }

        this.stageResults[stageName] = {
          stage: stageName,
          status: 'completed',
          agentResults: validatedResults,
          startedAt: stageResult.startedAt ?? '',
          completedAt: stageResult.completedAt ?? '',
          errors: [],
        }
      }
    }
  }

  /**
   * Count content items from creation stage results.
   */
  private countContentItems(state: PipelineRun): number {
    const creation = state.stages['creation']
    if (!creation || creation.status !== 'completed') return 0
    return Object.keys(creation.agentResults).length
  }

  /**
   * Collect content from completed stages and enqueue as ReviewItems.
   * For standard workflows: creation stage outputs are the content source.
   * For ECT (optimize) workflows: optimization stage outputs are the content source.
   * Quality/optimization scores are attached when available.
   */
  private async enqueueForReview(): Promise<void> {
    const runId = this.stateMachine.getRunId()
    const isECT = this.config.workflowMode === 'optimize'

    // Determine which stage produced the primary content
    const contentStage = isECT ? 'optimization' : 'creation'
    const contentResults = this.stageResults[contentStage]
    if (!contentResults) return

    const qualityResults = this.stageResults['quality']
    const optimizationResults = this.stageResults['optimization']
    const now = new Date().toISOString()
    const reviewItems: ReviewItem[] = []

    for (const [agentName, agentResult] of Object.entries(contentResults.agentResults)) {
      if (agentResult.status !== 'success' || !agentResult.result) continue

      const outputs = agentResult.result.outputs as Record<string, unknown> | undefined
      if (!outputs) continue

      // Determine platform from agent name or optimize context
      let platform: 'reddit' | 'tiktok' | 'facebook' | 'instagram' = 'tiktok'
      const platformMatch = agentName.match(/^(reddit|tiktok|facebook|instagram)-/)
      if (platformMatch) {
        platform = platformMatch[1] as typeof platform
      } else if (this.config.optimizeContext?.platform) {
        platform = this.config.optimizeContext.platform
      } else if (this.config.platforms.length > 0) {
        platform = this.config.platforms[0] as typeof platform
      }

      // Extract content fields from agent output
      const body = typeof outputs.body === 'string' ? outputs.body
        : typeof outputs.caption === 'string' ? outputs.caption
        : typeof outputs.content === 'string' ? outputs.content
        : JSON.stringify(outputs)
      const title = typeof outputs.title === 'string' ? outputs.title : undefined
      const hashtags = Array.isArray(outputs.hashtags) ? outputs.hashtags.map(String) : undefined

      // Get quality score from quality stage if available
      let qualityScore = 0.5 // default
      if (qualityResults) {
        const qualityAgent = Object.values(qualityResults.agentResults).find(
          (r) => r.status === 'success' && r.result?.outputs,
        )
        if (qualityAgent?.result?.outputs) {
          const qOut = qualityAgent.result.outputs as Record<string, unknown>
          const score = typeof qOut.score === 'number' ? qOut.score
            : typeof qOut.qualityScore === 'number' ? qOut.qualityScore
            : null
          if (score !== null) {
            qualityScore = score > 1 ? score / 100 : score // normalize to 0-1
          }
        }
      }

      // For ECT mode, merge optimization results into platformMeta
      const platformMeta: Record<string, unknown> = {}
      if (isECT && optimizationResults) {
        for (const [optAgent, optResult] of Object.entries(optimizationResults.agentResults)) {
          if (optResult.status === 'success' && optResult.result?.outputs) {
            platformMeta[optAgent] = optResult.result.outputs
          }
        }
      }

      reviewItems.push({
        id: `item-${randomUUID().slice(0, 12)}`,
        runId,
        platform,
        status: 'pending',
        content: {
          body,
          title,
          hashtags,
          platformMeta,
        },
        qualityScore,
        complianceFlags: [],
        contentType: 'standard',
        generatedBy: agentName,
        generatedAt: now,
        editHistory: [],
        createdAt: now,
        updatedAt: now,
      })
    }

    if (reviewItems.length > 0) {
      try {
        const reviewQueue = new ReviewQueue(this.config.projectRoot)
        await reviewQueue.enqueue(reviewItems)
        await this.logger?.info('orchestrator', `Enqueued ${reviewItems.length} item(s) for review`)
        sseEmitter.broadcast({type: 'review:new', runId, timestamp: now} as never)
      } catch (error) {
        await this.logger?.error('orchestrator', `Failed to enqueue review items: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /** Runtime type guard for StageAgentResult deserialized from disk. */
  private isValidStageAgentResult(value: unknown): value is StageAgentResult {
    if (typeof value !== 'object' || value === null) return false
    const obj = value as Record<string, unknown>
    return (
      typeof obj.agentName === 'string' &&
      (obj.status === 'success' || obj.status === 'failed') &&
      typeof obj.duration === 'number'
    )
  }
}
