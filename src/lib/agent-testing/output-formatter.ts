import type {AgentTestResult} from './types.js'

export function formatTestResult(result: AgentTestResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2)
  }

  const lines: string[] = []

  // Header
  lines.push(`--- Agent Test: ${result.agentName} (${result.cluster}) ---`)
  lines.push('')
  lines.push(`Model: ${result.model} | Turns: ${result.turns} | Duration: ${formatDuration(result.duration)}`)
  lines.push('')

  // Content
  lines.push('--- Generated Content ---')
  lines.push(result.content)
  lines.push('')

  // Usage
  lines.push('--- Usage ---')
  lines.push(`Input tokens:   ${formatNumber(result.usage.inputTokens)}`)
  lines.push(`Output tokens:  ${formatNumber(result.usage.outputTokens)}`)
  lines.push(`Total tokens:   ${formatNumber(result.usage.totalTokens)}`)
  lines.push(`Cost:           $${result.usage.cost.toFixed(4)}`)
  lines.push('')

  // Status
  lines.push(`--- Status: ${result.status} ---`)

  // Errors (if any)
  if (result.errors.length > 0) {
    lines.push('')
    lines.push('--- Errors ---')
    for (const error of result.errors) {
      lines.push(`  [${error.code}] ${error.message}`)
      lines.push(`  Reason: ${error.reason}`)
      lines.push(`  Resolution: ${error.resolution}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  return `${(ms / 1000).toFixed(1)}s`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}
