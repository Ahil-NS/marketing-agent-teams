import {randomUUID} from 'node:crypto'

import {
  PipelineStateError,
  PipelineTransitionError,
} from './errors.js'
import {
  loadPipelineRun,
  savePipelineRun,
} from './state-serializer.js'
import type {
  PipelineError,
  PipelineRun,
  PipelineStage,
  StageResult,
  StageTransition,
} from './types.js'
import {
  PIPELINE_STAGES,
  REVIEW_STAGE,
} from './types.js'

function createInitialStages(): Record<PipelineStage, StageResult> {
  const stages = {} as Record<PipelineStage, StageResult>
  for (const stage of PIPELINE_STAGES) {
    stages[stage] = {
      status: 'pending',
      agentResults: {},
    }
  }

  return stages
}

function getNextStage(current: PipelineStage): PipelineStage | null {
  const index = PIPELINE_STAGES.indexOf(current)
  if (index === -1 || index >= PIPELINE_STAGES.length - 1) {
    return null
  }

  return PIPELINE_STAGES[index + 1]
}

export class PipelineStateMachine {
  private constructor(
    private state: PipelineRun,
    private readonly projectDir: string,
  ) {}

  /**
   * Creates a new pipeline run with all stages set to 'pending'.
   */
  static async create(
    config: {platforms: string[]; dryRun: boolean},
    budget: {limit: number; dailyLimit?: number},
    projectDir: string = process.cwd(),
  ): Promise<PipelineStateMachine> {
    const now = new Date().toISOString()
    const state: PipelineRun = {
      id: randomUUID(),
      status: 'running',
      currentStage: PIPELINE_STAGES[0],
      stages: createInitialStages(),
      budget: {
        spent: 0,
        limit: budget.limit,
        currency: 'USD',
        dailySpent: 0,
        dailyLimit: budget.dailyLimit ?? 0,
      },
      config,
      errors: [],
      startedAt: now,
      updatedAt: now,
    }

    const machine = new PipelineStateMachine(state, projectDir)
    await machine.persist()
    return machine
  }

  /**
   * Resumes a pipeline run from disk. Validates state before returning.
   */
  static async resume(
    runId: string,
    projectDir: string = process.cwd(),
  ): Promise<PipelineStateMachine> {
    const state = await loadPipelineRun(runId, projectDir)

    if (state.status === 'completed') {
      throw new PipelineStateError(
        runId,
        'Cannot resume a completed pipeline run. Start a new run instead.',
      )
    }

    if (state.status === 'cancelled') {
      throw new PipelineStateError(
        runId,
        'Cannot resume a cancelled pipeline run. Start a new run instead.',
      )
    }

    return new PipelineStateMachine(state, projectDir)
  }

  /** Returns the current pipeline run state (deep-cloned readonly snapshot). */
  getState(): Readonly<PipelineRun> {
    return JSON.parse(JSON.stringify(this.state)) as PipelineRun
  }

  /** Returns the current stage. */
  getCurrentStage(): PipelineStage {
    return this.state.currentStage
  }

  /** Returns the pipeline run ID. */
  getRunId(): string {
    return this.state.id
  }

  /**
   * Marks the current stage as 'running'.
   * Call this when the stage-runner begins executing agents for the current stage.
   */
  async startStage(): Promise<void> {
    this.assertRunning()

    const stage = this.state.currentStage
    const stageResult = this.state.stages[stage]

    if (stageResult.status !== 'pending') {
      throw new PipelineTransitionError(
        this.state.id,
        stage,
        stageResult.status,
        'running',
        `Stage "${stage}" must be in 'pending' status to start, but is '${stageResult.status}'.`,
      )
    }

    stageResult.status = 'running'
    stageResult.startedAt = new Date().toISOString()
    await this.persist()
  }

  /**
   * Marks the current stage as 'completed' and advances to the next stage.
   * If the next stage is 'review', the pipeline auto-pauses.
   * If this was the last stage, the pipeline is marked 'completed'.
   *
   * **Note:** When the last stage completes, the returned transition has
   * `from === to` (both set to the final stage) with `toStatus: 'completed'`.
   * Downstream consumers should check `toStatus === 'completed'` to detect
   * pipeline completion rather than comparing `from !== to`.
   *
   * Returns the transition record.
   */
  async transition(
    agentResults: Record<string, unknown> = {},
  ): Promise<StageTransition> {
    this.assertRunning()

    const fromStage = this.state.currentStage
    const fromResult = this.state.stages[fromStage]

    if (fromResult.status !== 'running') {
      throw new PipelineTransitionError(
        this.state.id,
        fromStage,
        fromResult.status,
        'completed',
        `Stage "${fromStage}" must be in 'running' status to complete, but is '${fromResult.status}'.`,
      )
    }

    // Complete the current stage
    fromResult.status = 'completed'
    fromResult.completedAt = new Date().toISOString()
    fromResult.agentResults = agentResults

    const nextStage = getNextStage(fromStage)

    if (nextStage === null) {
      // Last stage completed — pipeline is done
      this.state.status = 'completed'
      this.state.completedAt = new Date().toISOString()
      await this.persist()
      return {
        from: fromStage,
        to: fromStage,
        fromStatus: 'running',
        toStatus: 'completed',
        timestamp: this.state.updatedAt,
      }
    }

    // Advance to next stage
    this.state.currentStage = nextStage

    // Auto-pause at review stage
    if (nextStage === REVIEW_STAGE) {
      this.state.status = 'paused'
      this.state.stages[nextStage].status = 'paused'
    }

    await this.persist()

    return {
      from: fromStage,
      to: nextStage,
      fromStatus: 'running',
      toStatus: nextStage === REVIEW_STAGE ? 'paused' : 'pending',
      timestamp: this.state.updatedAt,
    }
  }

  /**
   * Marks the current stage as 'failed' and records the error.
   * Only allowed when pipeline is 'running'.
   */
  async fail(error: Omit<PipelineError, 'stage' | 'timestamp'>): Promise<void> {
    this.assertRunning()

    const stage = this.state.currentStage
    const stageResult = this.state.stages[stage]

    const pipelineError: PipelineError = {
      ...error,
      stage,
      timestamp: new Date().toISOString(),
    }

    stageResult.status = 'failed'
    stageResult.error = pipelineError
    this.state.status = 'failed'
    this.state.errors.push(pipelineError)
    await this.persist()
  }

  /**
   * Pauses the pipeline at the current stage.
   */
  async pause(): Promise<void> {
    this.assertRunning()

    this.state.status = 'paused'
    this.state.stages[this.state.currentStage].status = 'paused'
    await this.persist()
  }

  /**
   * Resumes a paused pipeline from its current stage.
   * Resets the current stage status to 'pending' so it can be started again.
   */
  async unpause(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new PipelineStateError(
        this.state.id,
        `Cannot unpause: pipeline is '${this.state.status}', not 'paused'.`,
      )
    }

    this.state.status = 'running'
    this.state.stages[this.state.currentStage].status = 'pending'
    await this.persist()
  }

  /**
   * Retries a failed stage. Resets the stage to 'pending' and pipeline to 'running'.
   */
  async retry(): Promise<void> {
    if (this.state.status !== 'failed') {
      throw new PipelineStateError(
        this.state.id,
        `Cannot retry: pipeline is '${this.state.status}', not 'failed'.`,
      )
    }

    const stage = this.state.currentStage
    const stageResult = this.state.stages[stage]

    if (stageResult.status !== 'failed') {
      throw new PipelineStateError(
        this.state.id,
        `Cannot retry: stage "${stage}" is '${stageResult.status}', not 'failed'.`,
      )
    }

    stageResult.status = 'pending'
    stageResult.error = undefined
    stageResult.startedAt = undefined
    stageResult.completedAt = undefined
    stageResult.agentResults = {}
    this.state.status = 'running'
    await this.persist()
  }

  /**
   * Marks the pipeline as cancelled. Terminal state — cannot be resumed.
   */
  async cancel(): Promise<void> {
    this.assertNotTerminal()

    this.state.status = 'cancelled'
    await this.persist()
  }

  /**
   * Updates the budget spent amount.
   * Called by the budget tracker (Story 2.6) after each agent execution.
   * Only allowed when pipeline is 'running'.
   */
  async updateBudget(spent: number): Promise<void> {
    this.assertRunning()

    if (spent < 0) {
      throw new PipelineStateError(
        this.state.id,
        `Budget spent cannot be negative: ${spent}`,
      )
    }

    this.state.budget.spent = spent
    await this.persist()
  }

  // ------- Private helpers -------

  private assertRunning(): void {
    if (this.state.status !== 'running') {
      throw new PipelineStateError(
        this.state.id,
        `Pipeline is '${this.state.status}' — expected 'running'. Cannot perform this operation.`,
      )
    }
  }

  private assertNotTerminal(): void {
    if (this.state.status === 'completed' || this.state.status === 'cancelled') {
      throw new PipelineStateError(
        this.state.id,
        `Pipeline is '${this.state.status}' — this is a terminal state. Start a new run instead.`,
      )
    }
  }

  private async persist(): Promise<void> {
    this.state.updatedAt = new Date().toISOString()
    await savePipelineRun(this.state, this.projectDir)
  }
}
