import type {MATError} from '../utils/errors.js'

export interface AgentTestOptions {
  inputPath?: string
  model?: 'haiku' | 'sonnet'
  maxTurns?: number
  json?: boolean
}

export interface AgentTestResult {
  agentName: string
  cluster: string
  status: 'success' | 'partial' | 'failed'
  content: string
  outputs: Record<string, unknown>
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
  }
  duration: number
  model: string
  turns: number
  errors: MATError[]
}
