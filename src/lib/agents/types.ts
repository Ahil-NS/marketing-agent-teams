import type {MATError} from '../utils/errors.js'

export interface AgentResult<T = unknown> {
  agentName: string
  status: 'success' | 'partial' | 'failed'
  outputs: T
  usage: {
    inputTokens: number
    outputTokens: number
    cost: number
  }
  duration: number
  errors: MATError[]
}

export interface AgentInputs {
  brandName: string
  productDomain: string
}

export interface ResearchInputs extends AgentInputs {
  audienceType: string
  platforms: string[]
  trendTimeframeDays?: number
}
