import type {Config} from '../schemas/index.js'
import {MATError} from '../utils/errors.js'

const CLUSTERS: Record<string, string[]> = {
  intelligence: ['trend-scout', 'audience-researcher', 'competitor-analyst', 'viral-pattern-decoder', 'platform-algorithm'],
  strategy: ['content-strategist', 'campaign-planner', 'channel-optimizer'],
  creation: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'hook-writer'],
  optimization: ['seo-optimizer', 'ab-test-designer', 'timing-optimizer', 'hashtag-strategist'],
  quality: ['brand-guardian', 'fact-checker', 'platform-compliance', 'sensitivity-reviewer'],
  distribution: ['reddit-publisher', 'tiktok-publisher', 'facebook-publisher', 'instagram-publisher'],
  coordination: ['campaign-coordinator', 'performance-analyst', 'report-generator'],
}

const ALL_AGENTS = Object.values(CLUSTERS).flat()

export {ALL_AGENTS, CLUSTERS}

export interface AgentStatus {
  name: string
  enabled: boolean
}

export function listAgentsByCluster(config: Config): Record<string, AgentStatus[]> {
  const toggles = config.agents.toggles
  const result: Record<string, AgentStatus[]> = {}

  for (const [cluster, agents] of Object.entries(CLUSTERS)) {
    result[cluster] = agents.map(name => ({
      name,
      enabled: toggles[name]?.enabled !== false,
    }))
  }

  return result
}

export function validateAgentName(name: string): void {
  if (!ALL_AGENTS.includes(name)) {
    const suggestion = findClosestAgent(name)
    const resolutionMsg = suggestion
      ? `Did you mean "${suggestion}"? Run \`mat config agents\` to see all available agents.`
      : 'Run `mat config agents` to see all available agents.'

    throw new MATError(
      `Unknown agent: ${name}`,
      'CONFIG_AGENT_NOT_FOUND',
      `Agent "${name}" is not a recognized built-in agent.`,
      resolutionMsg,
      'lib/config',
      'permanent',
    )
  }
}

export function setAgentToggle(
  raw: Record<string, unknown>,
  agentName: string,
  enabled: boolean,
): void {
  validateAgentName(agentName)
  const rawAgents = (raw.agents ?? {}) as Record<string, unknown>
  const rawToggles = (rawAgents.toggles ?? {}) as Record<string, unknown>
  rawToggles[agentName] = {enabled}
  rawAgents.toggles = rawToggles
  raw.agents = rawAgents
}

function findClosestAgent(name: string): string | undefined {
  let best: string | undefined
  let bestDistance = Infinity
  for (const agent of ALL_AGENTS) {
    const d = levenshtein(name, agent)
    if (d < bestDistance) {
      bestDistance = d
      best = agent
    }
  }
  return bestDistance <= 5 ? best : undefined
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({length: m + 1}, () => Array.from({length: n + 1}, () => 0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
