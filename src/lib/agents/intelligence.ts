import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {trendBriefSchema, competitorReportSchema, viralPatternReportSchema, platformAlgorithmReportSchema} from '../schemas/agent-schema.js'
import type {TrendBrief, CompetitorReport, ViralPatternReport, PlatformAlgorithmReport} from '../schemas/agent-schema.js'

import {executeAgent} from './agent-executor.js'
import {loadSkill} from './skill-loader.js'
import type {AgentResult, ResearchInputs} from './types.js'

/**
 * Resolve the agents root directory.
 * Agents live in src/agents/ relative to the project root.
 */
function agentsRoot(): string {
  // __dirname equivalent: this file is at src/lib/agents/intelligence.ts
  // agents root is at src/agents/
  const __dirname = dirname(fileURLToPath(import.meta.url))
  return join(__dirname, '..', '..', 'agents')
}

/**
 * Run the Trend Scout intelligence agent.
 * Loads SKILL.md definition, constructs prompt from inputs, executes via Agent SDK,
 * and validates output against trendBriefSchema.
 */
export async function runTrendScout(inputs: ResearchInputs): Promise<AgentResult<TrendBrief>> {
  const timeframe = inputs.trendTimeframeDays ?? 30
  const skill = await loadSkill(join(agentsRoot(), 'intelligence', 'trend-scout'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('trend-scout', {
    prompt: `Research current trends for brand "${inputs.brandName}" in domain "${inputs.productDomain}".
Target audience: ${inputs.audienceType}
Target platforms: ${inputs.platforms.join(', ')}
Timeframe: last ${timeframe} days

Use your web search and research tools to find real, current trends.
Produce a trend brief following your output format specification.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: trendBriefSchema,
    maxTurns: 15,
  })
}

/**
 * Run the Competitor Analyst intelligence agent.
 * Loads SKILL.md definition, constructs prompt from inputs, executes via Agent SDK,
 * and validates output against competitorReportSchema.
 */
export async function runCompetitorAnalyst(inputs: ResearchInputs): Promise<AgentResult<CompetitorReport>> {
  const timeframe = inputs.trendTimeframeDays ?? 30
  const skill = await loadSkill(join(agentsRoot(), 'intelligence', 'competitor-analyst'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('competitor-analyst', {
    prompt: `Analyze competitor marketing strategies for brand "${inputs.brandName}" in domain "${inputs.productDomain}".
Target audience: ${inputs.audienceType}
Target platforms: ${inputs.platforms.join(', ')}
Timeframe: last ${timeframe} days

Research competitor social media presence, posting frequency, engagement rates, and content types.
Flag any viral competitor content. Produce a competitor report following your output format specification.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: competitorReportSchema,
    maxTurns: 15,
  })
}

/**
 * Run the Viral Pattern Decoder intelligence agent.
 * Loads SKILL.md definition, constructs prompt from inputs, executes via Agent SDK,
 * and validates output against viralPatternReportSchema.
 */
export async function runViralPatternDecoder(inputs: ResearchInputs): Promise<AgentResult<ViralPatternReport>> {
  const timeframe = inputs.trendTimeframeDays ?? 30
  const skill = await loadSkill(join(agentsRoot(), 'intelligence', 'viral-pattern-decoder'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('viral-pattern-decoder', {
    prompt: `Analyze viral content patterns for brand "${inputs.brandName}" in domain "${inputs.productDomain}".
Target audience: ${inputs.audienceType}
Target platforms: ${inputs.platforms.join(', ')}
Timeframe: last ${timeframe} days

Research current viral content on each target platform. Reverse-engineer WHY content went viral:
- Hook patterns (what grabs attention)
- Caption styles (what language patterns drive engagement)
- Hashtag strategies (what hashtag combinations amplify reach)
- Posting timing (when viral content was published)
- Content format (what formats are currently performing best)

Produce a viral pattern report following your output format specification.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: viralPatternReportSchema,
    maxTurns: 15,
  })
}

/**
 * Run the Platform Algorithm intelligence agent.
 * Loads SKILL.md definition, constructs prompt from inputs, executes via Agent SDK,
 * and validates output against platformAlgorithmReportSchema.
 */
export async function runPlatformAlgorithm(inputs: ResearchInputs): Promise<AgentResult<PlatformAlgorithmReport>> {
  const timeframe = inputs.trendTimeframeDays ?? 30
  const skill = await loadSkill(join(agentsRoot(), 'intelligence', 'platform-algorithm'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('platform-algorithm', {
    prompt: `Research current platform algorithm priorities for brand "${inputs.brandName}".
Target audience: ${inputs.audienceType}
Target platforms: ${inputs.platforms.join(', ')}
Product domain: ${inputs.productDomain}
Timeframe: last ${timeframe} days

For each target platform, research and report:
- Current algorithm ranking signals and priorities
- Recent algorithm changes or announcements
- Content format preferences (what the algorithm currently favors)
- Engagement signals that boost distribution
- Anti-patterns that suppress content reach
- Specific optimization strategies for the user's product domain

Use web search to find the MOST CURRENT information -- algorithm priorities change frequently.
Produce an algorithm report following your output format specification.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: platformAlgorithmReportSchema,
    maxTurns: 15,
  })
}
