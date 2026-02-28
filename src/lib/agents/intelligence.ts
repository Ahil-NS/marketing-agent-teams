import {trendBriefSchema} from '../schemas/agent-schema.js'
import type {TrendBrief} from '../schemas/agent-schema.js'

import {executeAgent} from './agent-executor.js'
import type {ResearchInputs} from './types.js'

const TREND_SCOUT_SYSTEM_PROMPT = `You are the Trend Scout agent for a marketing automation platform.

Your role is to research current trends, viral patterns, and marketing opportunities for a given brand and audience.

## Output Format

You MUST respond with ONLY a valid JSON object matching this exact structure:

{
  "trends": [
    {
      "name": "trend name",
      "description": "what this trend is about",
      "relevance": 0.0-1.0,
      "source": "optional source URL or reference"
    }
  ],
  "viralPatterns": [
    {
      "pattern": "description of the viral pattern",
      "platform": "platform name (e.g., tiktok, reddit, instagram)",
      "examples": ["optional example 1", "optional example 2"]
    }
  ],
  "opportunities": [
    {
      "description": "marketing opportunity description",
      "platform": "target platform",
      "priority": "high|medium|low"
    }
  ]
}

## Rules

- Research current, real-time trends using web search
- Focus on actionable marketing opportunities
- Score relevance from 0.0 (not relevant) to 1.0 (highly relevant)
- Prioritize opportunities based on potential impact and feasibility
- Return ONLY the JSON object — no markdown, no explanation, no code fences`

export async function runTrendScout(inputs: ResearchInputs): Promise<TrendBrief> {
  const timeframe = inputs.trendTimeframeDays ?? 30

  const result = await executeAgent('trend-scout', {
    prompt: `Research current trends for "${inputs.brandName}".
Product domain: ${inputs.productDomain}
Target audience: ${inputs.audienceType}
Target platforms: ${inputs.platforms.join(', ')}
Timeframe: last ${timeframe} days

Output a JSON trend brief.`,
    systemPrompt: TREND_SCOUT_SYSTEM_PROMPT,
    allowedTools: ['WebSearch', 'WebFetch'],
    model: 'haiku',
    outputSchema: trendBriefSchema,
  })

  return result.outputs
}
