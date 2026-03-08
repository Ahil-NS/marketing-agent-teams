import {z} from 'zod'

import {executeAgent} from '../agents/index.js'
import type {SkillDefinition} from '../agents/index.js'
import {SkillLoadError} from '../agents/errors.js'
import {AgentNotFoundError, AgentTestError} from './errors.js'
import {resolveTestInputs} from './input-resolver.js'
import type {AgentTestOptions, AgentTestResult} from './types.js'

// Permissive schema for isolated testing — agents may return any valid JSON (object or array)
const permissiveOutputSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())])

export async function runAgentTest(
  agentName: string,
  options: AgentTestOptions,
): Promise<AgentTestResult> {
  // 1. Load agent SKILL.md
  let skillDef: SkillDefinition

  try {
    // Dynamic import to avoid hard dependency on skill-loader at module level
    const {loadSkill, resolveAgentDir} = await import('../agents/skill-loader.js')
    const agentDir = await resolveAgentDir(agentName)
    skillDef = await loadSkill(agentDir)
  } catch (error) {
    if (error instanceof AgentNotFoundError || error instanceof SkillLoadError) {
      throw error
    }

    throw new AgentNotFoundError(agentName)
  }

  // 2. Resolve test inputs
  const testInputs = await resolveTestInputs(agentName, skillDef, options.inputPath)

  // 3. Determine execution parameters
  const model = options.model ?? skillDef.model ?? 'haiku'
  const maxTurns = options.maxTurns ?? 15

  // 4. Execute agent via Agent SDK
  const startTime = Date.now()

  try {
    const result = await executeAgent(agentName, {
      allowedTools: skillDef.tools ?? [],
      maxTurns,
      model,
      outputSchema: permissiveOutputSchema,
      prompt: buildTestPrompt(agentName, testInputs),
      systemPrompt: skillDef.systemPrompt,
    })

    const duration = Date.now() - startTime

    // 5. Build test result with usage metrics
    return {
      agentName,
      cluster: skillDef.cluster,
      content: JSON.stringify(result.outputs, null, 2),
      duration,
      errors: result.errors,
      model,
      outputs: result.outputs as Record<string, unknown>,
      status: result.status,
      // Turn count not available from current AgentResult — requires SDK adapter (Story 2.10)
      turns: 0,
      usage: {
        cost: result.usage.cost,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      },
    }
  } catch (error) {
    if (error instanceof AgentTestError || error instanceof AgentNotFoundError) {
      throw error
    }

    throw new AgentTestError(
      agentName,
      error instanceof Error ? error.message : String(error),
    )
  }
}

function buildTestPrompt(
  agentName: string,
  inputs: Record<string, unknown>,
): string {
  const inputLines = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')

  return `Execute the ${agentName} agent with the following test inputs:\n\n${inputLines}\n\nRespond with ONLY valid JSON. Do not include markdown, explanations, or any text outside the JSON object.`
}
