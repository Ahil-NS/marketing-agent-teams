import {createLogger} from '../logging/logger.js'
import type {Logger} from '../logging/logger.js'

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
      {platforms: config.platforms, dryRun: config.dryRun},
      {limit: config.budgetLimit},
      config.projectRoot,
    )
    const orchestrator = new Orchestrator(config, stageRunner, sm, events)
    const matDir = `${config.projectRoot}/.mat`
    orchestrator.logger = await createLogger({matDir, runId: sm.getRunId()})
    await orchestrator.logger.info('orchestrator', `Pipeline created: ${sm.getRunId()}`, {
      platforms: config.platforms, dryRun: config.dryRun, budgetLimit: config.budgetLimit,
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

      // Start the stage (pending -> running)
      if (stageState.status === 'pending') {
        await this.stateMachine.startStage()
      }

      this.events?.onStageStart?.(stage)
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
        throw new AllAgentsFailedError(
          `All agents in stage '${stage}' failed`,
          'STAGE_ALL_AGENTS_FAILED',
          `Every agent in the ${stage} stage failed, preventing downstream stages from receiving input`,
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
        if (postState.status === 'paused') {
          this.events?.onPipelinePaused?.(postState.currentStage)
        }
        break
      }
    }

    return this.stateMachine.getState()
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
      },
      stageResults: this.stageResults,
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
