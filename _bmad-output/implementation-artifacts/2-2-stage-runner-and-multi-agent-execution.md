# Story 2.2: Stage Runner & Multi-Agent Execution

Status: done

## Story

As a developer,
I want a stage runner that executes multiple agents per pipeline stage using the Agent SDK,
so that the orchestrator can dispatch stage-appropriate agents with proper input resolution.

## Acceptance Criteria

1. **AC1: Multi-agent stage execution with input resolution**
   - Given a pipeline stage (e.g., `research`) has multiple agents to execute
   - When the stage runner invokes them
   - Then each agent's function is called with resolved inputs from upstream stages
   - And results are collected and stored in pipeline state

2. **AC2: Parallel execution of independent agents within a cluster**
   - Given independent agents within the same cluster (e.g., reddit-creator, tiktok-creator)
   - When the stage runner executes the creation stage
   - Then agents run in parallel via `Promise.all()` (FR63)
   - And all results are collected even if some agents fail (FR3, degraded mode)

3. **AC3: Graceful degradation on agent failure**
   - Given an agent within a stage fails
   - When the stage runner detects the failure
   - Then it continues executing remaining agents in the stage (NFR14)
   - And records the failure with actionable error details in the stage result

## Tasks / Subtasks

- [x] Task 1: Define stage runner types and interfaces (AC: #1, #2, #3)
  - [x] 1.1 Create `src/lib/orchestrator/types.ts` with: `PipelineStage`, `StageResult`, `StageAgentResult`, `StageConfig`, `StageRunnerOptions`, `AgentAssignment`
  - [x] 1.2 Define `PipelineStage` as a union type of the 7 pipeline stages: `'research' | 'strategy' | 'creation' | 'optimization' | 'quality' | 'review' | 'distribution'`
  - [x] 1.3 Define `PIPELINE_STAGES` ordered constant array for sequential iteration
  - [x] 1.4 Define `STAGE_AGENT_MAP` — maps each `PipelineStage` to its array of agent names (by cluster)
  - [x] 1.5 Define `StageResult` with: `status`, `agentResults`, `startedAt`, `completedAt`, `errors`
  - [x] 1.6 Export inferred types and re-export from `src/lib/orchestrator/index.ts`

- [x] Task 2: Create stage runner error classes (AC: #3)
  - [x] 2.1 Create `src/lib/orchestrator/errors.ts` with `StageExecutionError`, `StagePartialFailureError`, `StageInputResolutionError` — all extending MATError
  - [x] 2.2 `StageExecutionError`: all agents in a stage failed — stage cannot produce output
  - [x] 2.3 `StagePartialFailureError`: some agents failed but stage produced partial output (degraded mode)
  - [x] 2.4 `StageInputResolutionError`: upstream stage outputs could not be resolved into agent inputs
  - [x] 2.5 Each error includes what happened, why, and what to do next (NFR27)

- [x] Task 3: Implement input resolution (AC: #1)
  - [x] 3.1 Create `src/lib/orchestrator/input-resolver.ts` with `resolveInputs(stage, upstreamResults)` function
  - [x] 3.2 The resolver reads `stageResults` from `PipelineRun` and extracts outputs relevant to the target stage's agents
  - [x] 3.3 Each stage has a known input contract: research needs `ResearchInputs`, strategy needs research outputs, creation needs strategy outputs, etc.
  - [x] 3.4 Throw `StageInputResolutionError` if required upstream outputs are missing (unless the missing output came from a failed agent in degraded mode)
  - [x] 3.5 In degraded mode: resolve what is available, mark missing inputs as `null`, let agents handle partial context

- [x] Task 4: Implement stage runner core (AC: #1, #2, #3)
  - [x] 4.1 Create `src/lib/orchestrator/stage-runner.ts` with the `StageRunner` class
  - [x] 4.2 Implement `runStage(stage, pipelineRun)` as the primary public method
  - [x] 4.3 `runStage` resolves inputs via `resolveInputs()`, maps agents to assignments, and dispatches execution
  - [x] 4.4 Implement `executeAgentsInParallel(assignments)` using `Promise.allSettled()` for graceful failure handling
  - [x] 4.5 Collect all results (fulfilled + rejected) into `StageResult`
  - [x] 4.6 Determine stage status: `'completed'` if all agents succeeded, `'partial'` if some failed, `'failed'` if all failed
  - [x] 4.7 Return `StageResult` with agent-level detail for every agent (success or failure)

- [x] Task 5: Create public API and module structure (AC: #1)
  - [x] 5.1 Create `src/lib/orchestrator/index.ts` — public API: exports `StageRunner`, `resolveInputs`, types, errors
  - [x] 5.2 Ensure all internal imports use `.js` extension (ESM)
  - [x] 5.3 Ensure all type-only imports use `import type`

- [x] Task 6: Write tests (AC: #1, #2, #3)
  - [x] 6.1 Create `test/lib/orchestrator/stage-runner.test.ts` — test parallel execution, failure collection, degraded mode, input resolution
  - [x] 6.2 Create `test/lib/orchestrator/input-resolver.test.ts` — test input resolution: success, missing upstream, degraded mode
  - [x] 6.3 Create `test/lib/orchestrator/errors.test.ts` — test error classes: message format, code, reason, resolution
  - [x] 6.4 Create `test/fixtures/state/sample-pipeline-run.json` — sample PipelineRun state for testing
  - [x] 6.5 Create `test/helpers/mock-agent-executor.ts` — mock `executeAgent()` for stage runner tests (reuses mock from Story 2.1)
  - [x] 6.6 Regression: run full `vitest run` after all tasks

## Dev Notes

### Architecture Constraints

- **Orchestration Layer:** `src/lib/orchestrator/` is the Orchestration Layer — it coordinates agent execution across pipeline stages. It calls into the Domain Layer (`src/lib/agents/`) but never contains agent logic itself.
- **Module structure:** `src/lib/orchestrator/` follows standard pattern: `index.ts` (public API), implementation files, `types.ts`, `errors.ts`
- **Data flow:** Agents never communicate directly. All data flows through pipeline state: `Agent A (output) -> Pipeline State -> Agent B (input)`. The stage runner enforces this by resolving inputs from `PipelineRun.stageResults`.
- **Import rules:** Export through `index.ts` only. Use `import type` for type-only imports. All imports use `.js` extension.
- **Boundary:** The stage runner consumes `executeAgent()` from `src/lib/agents/agent-executor.ts` (Story 2.1). It does NOT call `query()` directly. In Story 2.10, `executeAgent()` will be refactored behind the `AgentExecutor` adapter interface — the stage runner will then call `agentExecutor.execute()` instead.

### Technical Stack for This Story

| Library | Version | Purpose |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | 0.2.63 (exact) | Consumed indirectly via `executeAgent()` from Story 2.1 |
| `zod` | 4.3.6 | Validation for stage configuration and input contracts |
| `vitest` | latest | Testing framework |

### Pipeline Stages & Agent Mapping

The 7 pipeline stages and their agents, organized by cluster:

```typescript
// src/lib/orchestrator/types.ts

export type PipelineStage =
  | 'research'
  | 'strategy'
  | 'creation'
  | 'optimization'
  | 'quality'
  | 'review'
  | 'distribution'

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'research',
  'strategy',
  'creation',
  'optimization',
  'quality',
  'review',
  'distribution',
] as const

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
  review: [],  // Human review — pipeline pauses, no agent execution
  distribution: ['reddit-publisher', 'tiktok-publisher', 'facebook-publisher', 'instagram-publisher'],
} as const
```

### StageResult Type

```typescript
// src/lib/orchestrator/types.ts

import type { AgentResult } from '../agents/types.js'
import type { MATError } from '../utils/errors.js'

export type StageStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'skipped'

export interface StageAgentResult {
  agentName: string
  status: 'success' | 'failed'
  result: AgentResult | null
  error: MATError | null
  duration: number  // milliseconds
}

export interface StageResult {
  stage: PipelineStage
  status: StageStatus
  agentResults: Record<string, StageAgentResult>
  startedAt: string   // ISO 8601
  completedAt: string // ISO 8601
  errors: MATError[]
}
```

### PipelineRun Type (from Story 2.4 — consumed here)

The stage runner reads from and writes to `PipelineRun`. This type is defined in Story 2.4 but consumed here. For this story, use the following interface contract:

```typescript
// src/lib/orchestrator/types.ts — minimal PipelineRun consumed by stage runner
// Full PipelineRun implementation comes in Story 2.4

export interface PipelineRun {
  id: string
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  currentStage: PipelineStage
  stageResults: Record<PipelineStage, StageResult>
  config: {
    platforms: string[]
    dryRun: boolean
    enabledAgents?: string[]  // Subset of agents to run (FR49)
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
```

### AgentAssignment Type

```typescript
// src/lib/orchestrator/types.ts

export interface AgentAssignment {
  agentName: string
  stage: PipelineStage
  inputs: Record<string, unknown>  // Resolved from upstream stage outputs
}
```

### StageRunnerOptions Type

```typescript
// src/lib/orchestrator/types.ts

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
```

### Stage Runner Implementation

```typescript
// src/lib/orchestrator/stage-runner.ts
import { executeAgent } from '../agents/agent-executor.js'
import { resolveInputs } from './input-resolver.js'
import { StageExecutionError, StagePartialFailureError } from './errors.js'
import type {
  AgentAssignment,
  PipelineRun,
  PipelineStage,
  StageAgentResult,
  StageResult,
  StageRunnerOptions,
} from './types.js'
import {
  DEFAULT_STAGE_RUNNER_OPTIONS,
  STAGE_AGENT_MAP,
} from './types.js'

export class StageRunner {
  private readonly options: Required<StageRunnerOptions>

  constructor(options?: StageRunnerOptions) {
    this.options = { ...DEFAULT_STAGE_RUNNER_OPTIONS, ...options }
  }

  /**
   * Execute all agents for a given pipeline stage.
   *
   * Agents within a stage run in parallel via Promise.allSettled() (FR63).
   * If some agents fail, the stage completes in degraded mode (FR3, NFR14).
   * If ALL agents fail, the stage is marked as failed.
   *
   * @param stage - The pipeline stage to execute
   * @param pipelineRun - Current pipeline run state (for input resolution)
   * @returns StageResult with per-agent results
   */
  async runStage(
    stage: PipelineStage,
    pipelineRun: PipelineRun,
  ): Promise<StageResult> {
    const startedAt = new Date().toISOString()
    const agentNames = this.getAgentsForStage(stage, pipelineRun)

    // Skip stages with no agents (e.g., 'review' stage)
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

    // Resolve inputs from upstream stage outputs
    const assignments = this.buildAssignments(stage, agentNames, pipelineRun)

    // Execute all agents in parallel
    const agentResults = await this.executeAgentsInParallel(assignments)

    // Determine stage status
    const completedAt = new Date().toISOString()
    const errors = this.collectErrors(agentResults)
    const status = this.determineStageStatus(agentResults)

    const stageResult: StageResult = {
      stage,
      status,
      agentResults: this.toAgentResultRecord(agentResults),
      startedAt,
      completedAt,
      errors,
    }

    return stageResult
  }

  /**
   * Determine which agents to run for a stage.
   * Respects enabledAgents config (FR49) — if set, only run agents in that list.
   */
  private getAgentsForStage(
    stage: PipelineStage,
    pipelineRun: PipelineRun,
  ): string[] {
    const allAgents = [...STAGE_AGENT_MAP[stage]]
    const enabledAgents = pipelineRun.config.enabledAgents

    if (!enabledAgents || enabledAgents.length === 0) {
      return allAgents
    }

    return allAgents.filter(agent => enabledAgents.includes(agent))
  }

  /**
   * Build agent assignments with resolved inputs from upstream stages.
   */
  private buildAssignments(
    stage: PipelineStage,
    agentNames: string[],
    pipelineRun: PipelineRun,
  ): AgentAssignment[] {
    const resolvedInputs = resolveInputs(stage, pipelineRun.stageResults)

    return agentNames.map(agentName => ({
      agentName,
      stage,
      inputs: resolvedInputs,
    }))
  }

  /**
   * Execute agents in parallel using Promise.allSettled().
   *
   * Promise.allSettled() ensures ALL agents are awaited even if some reject.
   * This is critical for degraded mode (FR3, NFR14) — a single agent failure
   * must not prevent other agents from completing.
   */
  private async executeAgentsInParallel(
    assignments: AgentAssignment[],
  ): Promise<StageAgentResult[]> {
    const promises = assignments.map(assignment =>
      this.executeWithTimeout(assignment),
    )

    const settled = await Promise.allSettled(promises)

    return settled.map((outcome, index) => {
      const { agentName } = assignments[index]

      if (outcome.status === 'fulfilled') {
        return outcome.value
      }

      // Rejected — agent threw an error
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
      systemPrompt: '',  // Loaded by executeAgent via skill-loader (Story 2.9)
      allowedTools: [],  // Loaded by executeAgent via skill-loader (Story 2.9)
      model: 'haiku',    // Loaded by executeAgent via skill-loader (Story 2.9)
      outputSchema: undefined as any,  // Agent-specific, resolved at execution time
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new AgentTimeoutError(assignment.agentName)),
        this.options.agentTimeoutMs,
      )
    })

    const result = await Promise.race([agentPromise, timeoutPromise])

    return {
      agentName: assignment.agentName,
      status: 'success',
      result,
      error: null,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Determine overall stage status from individual agent results.
   */
  private determineStageStatus(
    results: StageAgentResult[],
  ): 'completed' | 'partial' | 'failed' {
    const successCount = results.filter(r => r.status === 'success').length
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
      .filter(r => r.error !== null)
      .map(r => r.error!)
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
```

### Input Resolver Implementation

```typescript
// src/lib/orchestrator/input-resolver.ts
import { StageInputResolutionError } from './errors.js'
import type { PipelineStage, StageResult } from './types.js'
import { PIPELINE_STAGES } from './types.js'

/**
 * Maps each stage to the upstream stages it depends on for input.
 * Research has no upstream (it uses PipelineRun.config as input).
 * Each subsequent stage depends on all prior stages' outputs.
 */
const STAGE_INPUT_DEPENDENCIES: Record<PipelineStage, readonly PipelineStage[]> = {
  research: [],                                                    // No upstream — uses config
  strategy: ['research'],                                          // Needs research outputs
  creation: ['research', 'strategy'],                              // Needs research + strategy
  optimization: ['creation'],                                      // Needs raw content
  quality: ['creation', 'optimization'],                           // Needs content + optimizations
  review: ['quality'],                                             // Needs quality-checked content
  distribution: [],                                                // Uses approved items from review queue (separate path)
} as const

/**
 * Resolve inputs for a pipeline stage from upstream stage results.
 *
 * In degraded mode (some upstream agents failed), available outputs are
 * collected and missing data is marked as null. Downstream agents must
 * handle partial context gracefully.
 *
 * @param stage - Target stage to resolve inputs for
 * @param stageResults - Current pipeline run stage results
 * @returns Resolved inputs as a record of upstream agent outputs
 * @throws StageInputResolutionError if required upstream stages have not run
 */
export function resolveInputs(
  stage: PipelineStage,
  stageResults: Record<PipelineStage, StageResult>,
): Record<string, unknown> {
  const dependencies = STAGE_INPUT_DEPENDENCIES[stage]

  // Research stage — no upstream dependencies
  if (dependencies.length === 0) {
    return {}
  }

  const resolvedInputs: Record<string, unknown> = {}

  for (const depStage of dependencies) {
    const depResult = stageResults[depStage]

    // Check if the dependency stage has run at all
    if (!depResult || depResult.status === 'pending') {
      throw new StageInputResolutionError(
        `Stage "${stage}" depends on stage "${depStage}" which has not executed yet`,
        'STAGE_INPUT_MISSING',
        `Upstream stage "${depStage}" has not been executed. Cannot resolve inputs for stage "${stage}".`,
        `Ensure the pipeline runs stages in order: ${PIPELINE_STAGES.join(' -> ')}. Check if stage "${depStage}" was skipped or is still pending.`,
        'input-resolver',
        'permanent',
      )
    }

    // Collect outputs from all successful agents in the dependency stage
    for (const [agentName, agentResult] of Object.entries(depResult.agentResults)) {
      if (agentResult.status === 'success' && agentResult.result) {
        resolvedInputs[agentName] = agentResult.result.outputs
      } else {
        // Degraded mode: mark failed agent output as null (FR3)
        resolvedInputs[agentName] = null
      }
    }
  }

  return resolvedInputs
}
```

### Error Classes

```typescript
// src/lib/orchestrator/errors.ts
import { MATError } from '../utils/errors.js'
import type { ErrorSeverity } from '../utils/errors.js'

/**
 * All agents in a stage failed — stage cannot produce any output.
 * Pipeline may continue if downstream stages can tolerate missing input.
 */
export class StageExecutionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

/**
 * Some agents in a stage failed but the stage produced partial output.
 * This is the "degraded mode" case (FR3, NFR14).
 * The pipeline continues with available outputs; downstream agents
 * receive null for missing upstream agent outputs.
 */
export class StagePartialFailureError extends MATError {
  public readonly failedAgents: string[]
  public readonly succeededAgents: string[]

  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
    failedAgents: string[],
    succeededAgents: string[],
  ) {
    super(message, code, reason, resolution, source, severity)
    this.failedAgents = failedAgents
    this.succeededAgents = succeededAgents
  }
}

/**
 * Upstream stage outputs could not be resolved into inputs for the target stage.
 * This typically means a required upstream stage has not run or produced no output.
 */
export class StageInputResolutionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}
```

### Error Codes for This Story

| Code | Error Class | Meaning |
|---|---|---|
| `STAGE_ALL_AGENTS_FAILED` | `StageExecutionError` | Every agent in the stage failed — no output produced |
| `STAGE_PARTIAL_FAILURE` | `StagePartialFailureError` | Some agents failed but stage produced partial output |
| `STAGE_INPUT_MISSING` | `StageInputResolutionError` | Required upstream stage has not executed |
| `STAGE_INPUT_INCOMPLETE` | `StageInputResolutionError` | Upstream stage ran but produced no usable output |
| `STAGE_AGENT_TIMEOUT` | `StageExecutionError` | An agent exceeded the per-agent timeout (NFR5) |
| `STAGE_NO_AGENTS` | `StageExecutionError` | Stage has no agents assigned (all disabled via FR49) |

### Public API (index.ts)

```typescript
// src/lib/orchestrator/index.ts
export { StageRunner } from './stage-runner.js'
export { resolveInputs } from './input-resolver.js'
export {
  StageExecutionError,
  StagePartialFailureError,
  StageInputResolutionError,
} from './errors.js'
export type {
  PipelineStage,
  PipelineRun,
  StageResult,
  StageAgentResult,
  StageStatus,
  StageRunnerOptions,
  AgentAssignment,
} from './types.js'
export {
  PIPELINE_STAGES,
  STAGE_AGENT_MAP,
  DEFAULT_STAGE_RUNNER_OPTIONS,
} from './types.js'
```

### Promise.allSettled vs Promise.all — Design Decision

This story uses `Promise.allSettled()` instead of `Promise.all()` for agent execution. This is a deliberate choice:

| | `Promise.all()` | `Promise.allSettled()` |
|---|---|---|
| On first failure | Rejects immediately, cancels pending | Waits for all to complete |
| Result shape | Single value or single error | Array of `{status, value/reason}` per promise |
| Degraded mode (FR3) | Requires wrapper to prevent early rejection | Natural fit — all agents run to completion |
| Error collection | Must catch individually before `Promise.all` | All errors collected after settlement |

`Promise.allSettled()` directly implements FR3 (continue in degraded mode) and NFR14 (individual failure does not crash pipeline). It is the correct primitive for this use case.

### Relationship: StageRunner vs executeAgent()

```
Orchestrator (Story 2.5)
  |
  v
StageRunner.runStage(stage, pipelineRun)     <-- THIS STORY
  |
  |-- resolveInputs(stage, stageResults)     <-- THIS STORY
  |-- Promise.allSettled(agentPromises)       <-- THIS STORY
  |     |
  |     v
  |   executeAgent(agentName, options)        <-- Story 2.1
  |     |
  |     v
  |   query({ prompt, options })              <-- Agent SDK
  |
  v
StageResult (stored in PipelineRun)          <-- Story 2.4
```

The stage runner is the bridge between the Orchestration Layer and the Domain Layer. It knows about pipeline stages, input resolution, and parallelism. It does NOT know about individual agent logic, SKILL.md content, or SDK internals.

### executeAgent() Call Pattern (from Story 2.1)

The stage runner calls `executeAgent()` for each agent. In the MVP, the call looks like:

```typescript
// How the stage runner invokes an agent
const result = await executeAgent('trend-scout', {
  prompt: JSON.stringify(resolvedInputs),
  systemPrompt: '',      // Placeholder — skill-loader (Story 2.9) provides this
  allowedTools: [],      // Placeholder — skill-loader (Story 2.9) provides this
  model: 'haiku',        // Placeholder — skill-loader (Story 2.9) provides this
  outputSchema: z.any(), // Placeholder — agent-specific schema
})
```

In Story 2.9 (skill-loader), the stage runner will load the `SkillDefinition` and pass its content to `executeAgent()`:

```typescript
// After Story 2.9 — skill-loader provides agent config
const skill = await loadSkill(`src/agents/${agentCluster}/${agentName}`)
const result = await executeAgent(agentName, {
  prompt: JSON.stringify(resolvedInputs),
  systemPrompt: `${skill.systemPrompt}\n\n## Knowledge Base\n\n${skill.knowledgeContext}`,
  allowedTools: skill.tools,
  model: skill.model,
  outputSchema: getOutputSchema(agentName),  // Agent-specific Zod schema
})
```

In Story 2.10 (AgentExecutor adapter), the stage runner will call the adapter interface:

```typescript
// After Story 2.10 — adapter interface
const result = await agentExecutor.execute({
  skillMd: skill.systemPrompt,
  input: resolvedInputs,
  model: skill.model,
  allowedTools: skill.tools,
  budget: { maxCostUsd: budgetRemaining },
})
```

Design `runStage()` so these transitions are mechanical — the core loop (resolve inputs, dispatch in parallel, collect results) does not change.

### File Structure

| File | Purpose |
|---|---|
| `src/lib/orchestrator/index.ts` | Public API — exports StageRunner, resolveInputs, types, errors |
| `src/lib/orchestrator/stage-runner.ts` | StageRunner class — executes agents per pipeline stage in parallel |
| `src/lib/orchestrator/input-resolver.ts` | resolveInputs() — resolves agent inputs from upstream stage outputs |
| `src/lib/orchestrator/types.ts` | PipelineStage, PipelineRun, StageResult, StageAgentResult, AgentAssignment, StageRunnerOptions, PIPELINE_STAGES, STAGE_AGENT_MAP |
| `src/lib/orchestrator/errors.ts` | StageExecutionError, StagePartialFailureError, StageInputResolutionError |
| `test/lib/orchestrator/stage-runner.test.ts` | StageRunner unit tests — parallel execution, failure handling, degraded mode |
| `test/lib/orchestrator/input-resolver.test.ts` | Input resolution tests — upstream success, missing stages, degraded mode |
| `test/lib/orchestrator/errors.test.ts` | Error class tests — message format, code, reason, resolution |
| `test/fixtures/state/sample-pipeline-run.json` | Sample PipelineRun JSON for test fixtures |
| `test/helpers/mock-agent-executor.ts` | Mock executeAgent() returning canned AgentResult values |

### Anti-Patterns to Avoid

- DO NOT call `query()` directly from the stage runner — all agent execution goes through `executeAgent()` (Story 2.1)
- DO NOT use `Promise.all()` for parallel agent execution — use `Promise.allSettled()` to support degraded mode (FR3, NFR14)
- DO NOT abort remaining agents when one fails — the stage runner MUST continue executing all agents (NFR14)
- DO NOT store agent logic or system prompts in the stage runner — it is Orchestration Layer, not Domain Layer
- DO NOT implement pipeline state persistence in this story — it comes in Story 2.4
- DO NOT implement budget checking in this story — it comes in Story 2.6
- DO NOT implement the full Orchestrator class in this story — it comes in Story 2.5
- DO NOT parse SKILL.md in this story — skill-loader comes in Story 2.9; use placeholder values
- DO NOT implement the AgentExecutor adapter interface in this story — it comes in Story 2.10
- DO NOT implement retry logic for failed agents within the stage runner — stage-level retry comes via the Orchestrator (Story 2.5)
- DO NOT put platform-specific code in the stage runner — all platforms use the same execution path (Story 6.1a)

### What This Story Does NOT Include (Deferred)

| Capability | Deferred To |
|---|---|
| Pipeline state persistence | Story 2.4 |
| Orchestrator coordination (stage sequencing) | Story 2.5 |
| Budget tracking and cost control | Story 2.6 |
| Skill-loader (SKILL.md parsing) | Story 2.9 |
| AgentExecutor adapter interface | Story 2.10 |
| Agent SKILL.md sandboxing | Story 2.11 |
| Platform adapter integration | Story 6.1a |
| Retry logic for failed stages | Story 2.5 |
| Quality gate blocking | Story 4.4 (Epic 4) |
| Review stage pause mechanism | Story 5.1 (Epic 5) |

### Downstream Consumers

| Consumer | How It Uses This Story's Output |
|---|---|
| Orchestrator (Story 2.5) | Calls `stageRunner.runStage()` for each pipeline stage in sequence |
| Pipeline State (Story 2.4) | Stores `StageResult` in `PipelineRun.stageResults` after each stage |
| Budget Tracker (Story 2.6) | Reads `StageResult.agentResults[*].result.usage.cost` to accumulate spending |
| CLI Status Command (Story 2.7) | Reads `StageResult.status` and `agentResults` to display progress |
| AgentExecutor Adapter (Story 2.10) | Replaces `executeAgent()` calls with `agentExecutor.execute()` — stage runner logic unchanged |
| Skill Loader (Story 2.9) | Stage runner will load `SkillDefinition` before calling `executeAgent()` |

### Upstream Dependencies

| Dependency | What This Story Needs From It |
|---|---|
| Story 2.1 (Agent SDK Integration) | `executeAgent()` function, `AgentResult` type, agent error classes |
| Story 2.4 (Pipeline State Machine) | `PipelineRun` type (consumed as interface contract, not implementation) |

### Testing Guidance

- **Framework:** vitest — `vitest run` for CI
- **vitest config MUST include** `disableConsoleIntercept: true`
- **Mock the agent executor:** Create `test/helpers/mock-agent-executor.ts` that provides a mock `executeAgent()` returning configurable `AgentResult` values. NEVER hit real Claude API in tests.
- **Mock pattern:**
  ```typescript
  vi.mock('../agents/agent-executor.js', () => ({
    executeAgent: vi.fn(),
  }))
  ```
- **Test scenarios:**

  **Stage Runner Tests (`stage-runner.test.ts`):**
  - All agents succeed: mock returns valid AgentResult for each agent -> StageResult.status is `'completed'` -> all agentResults have status `'success'`
  - Some agents fail: mock returns success for 2/3 agents, throws for 1 -> StageResult.status is `'partial'` -> failed agent has error details -> successful agents have results
  - All agents fail: mock throws for all agents -> StageResult.status is `'failed'` -> all agentResults have errors -> errors array populated
  - Empty stage (review): no agents in STAGE_AGENT_MAP -> StageResult.status is `'skipped'`
  - Agent timeout: mock hangs beyond `agentTimeoutMs` -> agent result shows timeout error -> other agents complete normally
  - Enabled agents filter: pipelineRun.config.enabledAgents set -> only matching agents execute
  - Parallel execution verification: mock delays each agent -> total time is max(delays) not sum(delays) — proves parallel execution

  **Input Resolver Tests (`input-resolver.test.ts`):**
  - Research stage: no dependencies -> returns empty object
  - Strategy stage with completed research: returns research agent outputs
  - Strategy stage with partial research (degraded): available outputs returned, failed agent outputs are null
  - Stage depends on unexecuted upstream: throws StageInputResolutionError
  - Creation stage with both research and strategy results: returns merged outputs from both upstream stages

  **Error Tests (`errors.test.ts`):**
  - StageExecutionError: message, code, reason, resolution, source, severity all set correctly
  - StagePartialFailureError: includes failedAgents and succeededAgents arrays
  - StageInputResolutionError: includes actionable resolution message
  - All errors extend MATError: `instanceof MATError` returns true
  - Error names: `error.name` matches class name (e.g., `'StageExecutionError'`)

- **Mock agent executor helper:**

  ```typescript
  // test/helpers/mock-agent-executor.ts
  import type { AgentResult } from '../../src/lib/agents/types.js'

  export function createMockAgentResult(
    agentName: string,
    overrides?: Partial<AgentResult>,
  ): AgentResult {
    return {
      agentName,
      status: 'success',
      outputs: { mockData: `output from ${agentName}` },
      usage: { inputTokens: 100, outputTokens: 50, cost: 0.001 },
      duration: 1500,
      errors: [],
      ...overrides,
    }
  }

  export function createMockExecuteAgent(
    resultMap: Record<string, AgentResult | Error>,
  ) {
    return vi.fn(async (agentName: string) => {
      const result = resultMap[agentName]
      if (result instanceof Error) throw result
      if (!result) throw new Error(`No mock result for agent: ${agentName}`)
      return result
    })
  }
  ```

- **Sample pipeline run fixture:**

  ```json
  // test/fixtures/state/sample-pipeline-run.json
  {
    "id": "run-test-001",
    "status": "running",
    "currentStage": "strategy",
    "stageResults": {
      "research": {
        "stage": "research",
        "status": "completed",
        "agentResults": {
          "trend-scout": {
            "agentName": "trend-scout",
            "status": "success",
            "result": {
              "agentName": "trend-scout",
              "status": "success",
              "outputs": { "trends": [], "viralPatterns": [], "opportunities": [] },
              "usage": { "inputTokens": 500, "outputTokens": 200, "cost": 0.003 },
              "duration": 4200,
              "errors": []
            },
            "error": null,
            "duration": 4200
          },
          "audience-researcher": {
            "agentName": "audience-researcher",
            "status": "success",
            "result": {
              "agentName": "audience-researcher",
              "status": "success",
              "outputs": { "segments": [], "demographics": {} },
              "usage": { "inputTokens": 400, "outputTokens": 150, "cost": 0.002 },
              "duration": 3800,
              "errors": []
            },
            "error": null,
            "duration": 3800
          },
          "competitor-analyst": {
            "agentName": "competitor-analyst",
            "status": "success",
            "result": {
              "agentName": "competitor-analyst",
              "status": "success",
              "outputs": { "competitors": [], "gaps": [] },
              "usage": { "inputTokens": 450, "outputTokens": 180, "cost": 0.0025 },
              "duration": 4000,
              "errors": []
            },
            "error": null,
            "duration": 4000
          }
        },
        "startedAt": "2026-02-28T10:00:00.000Z",
        "completedAt": "2026-02-28T10:00:04.200Z",
        "errors": []
      }
    },
    "config": {
      "platforms": ["reddit", "tiktok"],
      "dryRun": false
    },
    "budget": {
      "spent": 0.0075,
      "limit": 5.00,
      "currency": "USD"
    },
    "startedAt": "2026-02-28T10:00:00.000Z",
    "updatedAt": "2026-02-28T10:00:04.200Z",
    "errors": []
  }
  ```

- **Regression check:** Run full `vitest run` after completing all tasks

### Cross-Story Relationships

```
Epic 1 (CLI Bootstrap)
  |
  v
Story 2.1 (Agent SDK Integration)
  |-- executeAgent() function
  |-- AgentResult type
  |-- Agent error classes (AgentExecutionError, AgentTimeoutError)
  |
  v
Story 2.2 (THIS STORY — Stage Runner)
  |-- StageRunner class
  |-- resolveInputs() function
  |-- StageResult type
  |-- Stage error classes
  |
  +-----> Story 2.4 (Pipeline State)
  |         |-- PipelineRun type (consumed by stage runner)
  |         |-- State persistence (.mat/state/pipeline-runs/)
  |
  +-----> Story 2.5 (Orchestrator)
  |         |-- Calls stageRunner.runStage() per stage
  |         |-- Manages stage sequencing and retry
  |         |-- Consumes StageResult to drive pipeline forward
  |
  +-----> Story 2.6 (Budget Tracker)
  |         |-- Reads cost from StageResult.agentResults
  |
  +-----> Story 2.9 (Skill Loader)
  |         |-- Stage runner loads SkillDefinition before executeAgent()
  |
  +-----> Story 2.10 (AgentExecutor Adapter)
            |-- Stage runner calls agentExecutor.execute() instead of executeAgent()
```

### Project Structure Notes

- `src/lib/orchestrator/` is the first module in the Orchestration Layer to be implemented
- The `PipelineRun` type is defined as an interface contract in this story's `types.ts` — Story 2.4 provides the full implementation with persistence
- The `stage-runner.ts` file exists in `src/lib/orchestrator/`, NOT in `src/lib/agents/` — the stage runner is Orchestration Layer, not Domain Layer
- Architecture shows `stage-runner.ts` in both `src/lib/orchestrator/` and `src/lib/agents/` — use the Orchestration Layer location (`src/lib/orchestrator/stage-runner.ts`) as the canonical location per the 4-layer boundary architecture
- The MATError base class should already exist from Epic 1 stories (in `src/lib/utils/errors.ts`). The `executeAgent()` function should already exist from Story 2.1 (in `src/lib/agents/agent-executor.ts`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Agent Execution Model]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pipeline State Management]
- [Source: _bmad-output/planning-artifacts/architecture.md#AI Provider -- Claude Agent SDK]
- [Source: _bmad-output/planning-artifacts/architecture.md#AgentExecutor Adapter Interface]
- [Source: _bmad-output/planning-artifacts/architecture.md#Module Organization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture-pivot-skills-and-auth.md]
- [Source: _bmad-output/planning-artifacts/prd.md#FR1, FR2, FR3, FR63, NFR5, NFR14, NFR27]
- [Source: _bmad-output/implementation-artifacts/2-1-agent-yaml-schema-and-loader.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial stage-runner tests used `vi.doMock` + dynamic imports — failed due to module caching. Refactored to hoisted `vi.mock()` with `vi.mocked()` per-test customization — all 11 tests passed immediately.

### Completion Notes List

- **Task 1:** Created `src/lib/orchestrator/types.ts` with all type definitions: `PipelineStage` (7-stage union), `PIPELINE_STAGES` (frozen ordered array), `STAGE_AGENT_MAP` (23 agents across 7 stages), `StageResult`, `StageAgentResult`, `PipelineRun` (minimal contract for stage runner, full impl deferred to Story 2.4), `AgentAssignment`, `StageRunnerOptions` with defaults, `StageConfig`. 7 tests.
- **Task 2:** Created `src/lib/orchestrator/errors.ts` with 3 error classes extending MATError: `StageExecutionError` (all agents failed), `StagePartialFailureError` (degraded mode, includes failedAgents/succeededAgents arrays), `StageInputResolutionError` (missing upstream). All include code, reason, resolution, source, severity per NFR27. 6 tests.
- **Task 3:** Created `src/lib/orchestrator/input-resolver.ts` with `resolveInputs()`. Maps stage dependencies (e.g., strategy depends on research, creation depends on research+strategy). Throws `StageInputResolutionError` for missing/pending upstream. In degraded mode, marks failed agent outputs as `null` per FR3. 8 tests.
- **Task 4:** Created `src/lib/orchestrator/stage-runner.ts` with `StageRunner` class. `runStage()` resolves inputs, builds assignments, executes agents in parallel via `Promise.allSettled()` (FR63, FR3, NFR14), handles timeout via `Promise.race()` with proper `clearTimeout`, determines stage status (completed/partial/failed/skipped), respects `enabledAgents` filter (FR49), `continueOnFailure` option, and `concurrencyLimit` batching. 15 tests.
- **Task 5:** Updated `src/lib/orchestrator/index.ts` — public API exports `StageRunner`, `resolveInputs`, all error classes, all types, and constants. Verified `.js` extensions and `import type` throughout.
- **Task 6:** 32 total tests across 4 test files. Created `test/fixtures/state/sample-pipeline-run.json` and `test/helpers/mock-agent-executor.ts`. Full regression: 34 files, 331 tests, 0 failures.

### Change Log

- 2026-02-28: Implemented Story 2.2 — Stage Runner & Multi-Agent Execution (all 6 tasks, 32 new tests, 0 regressions)
- 2026-02-28: Code review fixes — H1: fixed timer leak in executeWithTimeout (clearTimeout on resolve), M1: removed dead try/catch, M2: implemented continueOnFailure option (partial→failed when false), M3: implemented concurrencyLimit via batch execution. Added 4 new tests (36 total). Full regression: 335 tests, 0 failures.

### File List

**New files:**
- `src/lib/orchestrator/types.ts` — Pipeline stage types, agent mapping, stage result types, pipeline run contract
- `src/lib/orchestrator/errors.ts` — StageExecutionError, StagePartialFailureError, StageInputResolutionError
- `src/lib/orchestrator/input-resolver.ts` — resolveInputs() for upstream stage output resolution
- `src/lib/orchestrator/stage-runner.ts` — StageRunner class with parallel agent execution
- `src/lib/orchestrator/index.ts` — Public API for orchestrator module
- `test/lib/orchestrator/types.test.ts` — 7 tests for type constants and defaults
- `test/lib/orchestrator/errors.test.ts` — 6 tests for error classes
- `test/lib/orchestrator/input-resolver.test.ts` — 8 tests for input resolution
- `test/lib/orchestrator/stage-runner.test.ts` — 11 tests for stage runner
- `test/fixtures/state/sample-pipeline-run.json` — Sample PipelineRun fixture
- `test/helpers/mock-agent-executor.ts` — Mock executeAgent helper for stage runner tests
