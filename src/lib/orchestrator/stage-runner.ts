import {z} from 'zod'

import {executeAgent} from '../agents/agent-executor.js'
import {AgentTimeoutError} from '../agents/errors.js'
import type {MATError} from '../utils/errors.js'

import {resolveInputs} from './input-resolver.js'
import type {
  AgentAssignment,
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

export class StageRunner {
  private readonly options: Required<StageRunnerOptions>

  constructor(options?: StageRunnerOptions) {
    this.options = {...DEFAULT_STAGE_RUNNER_OPTIONS, ...options}
  }

  /**
   * Execute all agents for a given pipeline stage.
   *
   * Agents within a stage run in parallel via Promise.allSettled() (FR63).
   * If some agents fail, the stage completes in degraded mode (FR3, NFR14).
   * If ALL agents fail, the stage is marked as failed.
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
   * Respects enabledAgents config (FR49).
   */
  private getAgentsForStage(
    stage: PipelineStage,
    pipelineRun: StageRunnerContext,
  ): string[] {
    const allAgents = [...STAGE_AGENT_MAP[stage]]
    const enabledAgents = pipelineRun.config.enabledAgents

    if (!enabledAgents || enabledAgents.length === 0) {
      return allAgents
    }

    return allAgents.filter((agent) => enabledAgents.includes(agent))
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

    const agentPromise = executeAgent(assignment.agentName, {
      prompt: JSON.stringify(assignment.inputs),
      systemPrompt: '', // Placeholder — skill-loader (Story 2.9) provides this
      allowedTools: [], // Placeholder — skill-loader (Story 2.9) provides this
      model: 'haiku', // Placeholder — skill-loader (Story 2.9) provides this
      outputSchema: z.record(z.string(), z.unknown()), // Permissive — agent-specific schemas applied downstream
    })

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
