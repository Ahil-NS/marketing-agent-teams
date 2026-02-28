import type {PipelineError, PipelineRun, PipelineStage} from '../orchestrator/index.js'

const STAGE_ORDER: PipelineStage[] = [
  'research', 'strategy', 'creation', 'optimization', 'quality', 'review', 'distribution',
]

const STATUS_INDICATORS: Record<string, string> = {
  pending: '  ',
  running: '>>',
  completed: 'OK',
  failed: '!!',
  paused: '||',
  skipped: '--',
}

export function formatRunStatus(run: PipelineRun): string {
  const lines: string[] = []

  lines.push(`Pipeline Run: ${run.id}`)
  lines.push(`Status: ${run.status}`)
  if (run.config.dryRun) lines.push('Mode: dry-run')
  lines.push(`Started: ${run.startedAt}`)
  lines.push(`Updated: ${run.updatedAt}`)
  lines.push('')

  // Per-stage status table
  lines.push('Stages:')
  for (const stage of STAGE_ORDER) {
    const result = run.stages[stage]
    const indicator = STATUS_INDICATORS[result?.status ?? 'pending'] ?? '  '
    const agents = result?.agentResults
      ? Object.keys(result.agentResults).length
      : 0
    lines.push(`  [${indicator}] ${stage.padEnd(14)} ${(result?.status ?? 'pending').padEnd(10)} (${agents} agents)`)
  }

  lines.push('')

  // Budget
  lines.push(`Budget: $${run.budget.spent.toFixed(4)} / $${run.budget.limit > 0 ? run.budget.limit.toFixed(2) : 'unlimited'}`)
  lines.push('')

  // Errors
  if (run.errors.length > 0) {
    lines.push(formatRunErrors(run.errors))
  }

  return lines.join('\n')
}

export function formatRunErrors(errors: PipelineError[]): string {
  const lines: string[] = ['Errors:']
  for (const err of errors) {
    lines.push(`  - [${err.code}] ${err.message}`)
    if (err.reason) lines.push(`    Reason: ${err.reason}`)
    if (err.resolution) lines.push(`    Fix: ${err.resolution}`)
  }

  return lines.join('\n')
}

export function formatRunSummary(runs: PipelineRun[]): string {
  if (runs.length === 0) return 'No pipeline runs found. Run `mat run` to start a pipeline.'

  const lines: string[] = ['Pipeline Run History:', '']
  lines.push('ID'.padEnd(40) + 'Status'.padEnd(12) + 'Started'.padEnd(22) + 'Stages')
  lines.push('-'.repeat(80))
  for (const run of runs) {
    const completedStages = STAGE_ORDER.filter(
      (s) => run.stages[s]?.status === 'completed',
    ).length
    lines.push(
      run.id.padEnd(40) +
      run.status.padEnd(12) +
      run.startedAt.padEnd(22) +
      `${completedStages}/${STAGE_ORDER.length}`,
    )
  }

  return lines.join('\n')
}
