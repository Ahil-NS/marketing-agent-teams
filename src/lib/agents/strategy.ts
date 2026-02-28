import {join} from 'node:path'

import {
  campaignPlanSchema,
  contentCalendarSchema,
  channelOptimizationPlanSchema,
} from '../schemas/strategy-schema.js'
import type {
  CampaignPlan,
  ContentCalendar,
  ChannelOptimizationPlan,
  StrategyInputs,
  CalendarInputs,
  OptimizerInputs,
} from '../schemas/strategy-schema.js'

import {executeAgent} from './agent-executor.js'
import {agentsRoot} from './paths.js'
import {loadSkill} from './skill-loader.js'
import type {AgentResult} from './types.js'

/**
 * Run the Content Strategist (Campaign Architect) agent.
 * Synthesizes research intelligence into a comprehensive campaign plan.
 *
 * Sequential dependency: Runs FIRST in the strategy stage (no upstream strategy dependencies).
 * Inputs: TrendBrief + CompetitorReport + ViralPatternReport + PlatformAlgorithmReport + BrandVoiceConfig
 * Output: CampaignPlan (consumed by campaign-planner and channel-optimizer)
 */
export async function runContentStrategist(inputs: StrategyInputs): Promise<AgentResult<CampaignPlan>> {
  const skill = await loadSkill(join(agentsRoot(), 'strategy', 'content-strategist'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('content-strategist', {
    prompt: `Generate a campaign plan for brand "${inputs.brandVoiceConfig.productName ?? 'the brand'}".

## Research Intelligence

### Current Trends
${JSON.stringify(inputs.trendBrief, null, 2)}

### Competitor Analysis
${JSON.stringify(inputs.competitorReport, null, 2)}

### Viral Content Patterns
${JSON.stringify(inputs.viralPatternReport, null, 2)}

### Platform Algorithm Intelligence
${JSON.stringify(inputs.platformAlgorithmReport, null, 2)}

## Brand Voice Configuration
- Tone: ${inputs.brandVoiceConfig.tone}
- Communication Style: ${inputs.brandVoiceConfig.communicationStyle}
- Brand Principles: ${inputs.brandVoiceConfig.brandPrinciples.join(', ')}
- Banned Phrases: ${inputs.brandVoiceConfig.bannedPhrases.join(', ')}

## Target Platforms
${inputs.platforms.join(', ')}

Synthesize all research intelligence into a comprehensive campaign plan.
Follow your output format specification exactly.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: campaignPlanSchema,
    maxTurns: 20,
  })
}

/**
 * Run the Campaign Planner (Content Calendar) agent.
 * Maps campaign themes across platforms and timeframes into a balanced calendar.
 *
 * Sequential dependency: Runs SECOND — requires CampaignPlan from content-strategist.
 * Inputs: CampaignPlan + BrandVoiceConfig
 * Output: ContentCalendar (consumed by channel-optimizer and creation stage)
 */
export async function runCampaignPlanner(inputs: CalendarInputs): Promise<AgentResult<ContentCalendar>> {
  const skill = await loadSkill(join(agentsRoot(), 'strategy', 'campaign-planner'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  const platforms = inputs.campaignPlan.contentThemes
    .flatMap((t) => Object.keys(t.platformFit))
    .filter((v, i, a) => a.indexOf(v) === i)

  return executeAgent('campaign-planner', {
    prompt: `Generate a content calendar based on the following campaign plan:

## Campaign Plan
${JSON.stringify(inputs.campaignPlan, null, 2)}

## Brand Voice
- Tone: ${inputs.brandVoiceConfig.tone}
- Communication Style: ${inputs.brandVoiceConfig.communicationStyle}

## Requirements
- Calendar duration: ${inputs.calendarDuration ?? '14-day'} rolling window
- Target platforms: ${platforms.join(', ')}
- Balance content mix across platforms (platformBalance must sum to ~1.0)
- Include seasonal events relevant to the campaign's domain
- Respect per-platform posting frequency recommendations from your knowledge base

Follow your output format specification exactly.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: contentCalendarSchema,
    maxTurns: 20,
  })
}

/**
 * Run the Channel Optimizer (Seasonal Campaign) agent.
 * Refines content calendar using algorithm intelligence and identifies seasonal opportunities.
 *
 * Sequential dependency: Runs THIRD — requires CampaignPlan + ContentCalendar + PlatformAlgorithmReport.
 * Inputs: CampaignPlan + ContentCalendar + PlatformAlgorithmReport
 * Output: ChannelOptimizationPlan (consumed by creation and distribution stages)
 */
export async function runChannelOptimizer(inputs: OptimizerInputs): Promise<AgentResult<ChannelOptimizationPlan>> {
  const skill = await loadSkill(join(agentsRoot(), 'strategy', 'channel-optimizer'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('channel-optimizer', {
    prompt: `Optimize the content calendar for each platform channel:

## Campaign Plan
${JSON.stringify(inputs.campaignPlan, null, 2)}

## Content Calendar
${JSON.stringify(inputs.contentCalendar, null, 2)}

## Platform Algorithm Intelligence
${JSON.stringify(inputs.platformAlgorithmReport, null, 2)}

## Requirements
- Optimize posting times per platform using algorithm intelligence
- Identify seasonal and event-driven opportunities within the calendar period
- Recommend content format adjustments per platform's current algorithm preferences
- Flag anti-patterns that could suppress content reach
- Suggest cross-platform coordination strategies

Follow your output format specification exactly.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: channelOptimizationPlanSchema,
    maxTurns: 20,
  })
}
