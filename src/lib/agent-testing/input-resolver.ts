import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

import {z} from 'zod'

import type {SkillDefinition} from '../agents/index.js'
import {TestInputError} from './errors.js'

const testInputSchema = z.record(z.string(), z.unknown())

// Cluster-specific default inputs for testing
const CLUSTER_DEFAULTS: Record<string, Record<string, unknown>> = {
  coordination: {
    campaignId: 'test-campaign-001',
    metrics: ['engagement', 'reach'],
    reportType: 'summary',
  },
  creation: {
    audienceType: 'developers',
    brandName: 'TestBrand',
    platform: 'reddit',
    tone: 'professional',
    topic: 'AI productivity tools',
  },
  distribution: {
    contentId: 'test-content-001',
    dryRun: true,
    platform: 'reddit',
  },
  intelligence: {
    audienceType: 'developers',
    brandName: 'TestBrand',
    platforms: ['reddit', 'tiktok'],
    productDomain: 'SaaS',
  },
  optimization: {
    audienceType: 'developers',
    content: 'Sample content for optimization testing',
    platform: 'reddit',
  },
  quality: {
    brandVoice: 'professional',
    content: 'Sample content for quality review',
    platform: 'reddit',
  },
  strategy: {
    audienceType: 'developers',
    brandName: 'TestBrand',
    goals: ['awareness', 'engagement'],
    platforms: ['reddit', 'tiktok'],
  },
}

export async function resolveTestInputs(
  agentName: string,
  skillDef: SkillDefinition,
  userInputPath?: string,
): Promise<Record<string, unknown>> {
  // Priority 1: User-provided input file
  if (userInputPath) {
    return loadInputFile(userInputPath)
  }

  // Priority 2: SKILL.md examples field
  if (skillDef.examples && skillDef.examples.length > 0) {
    return skillDef.examples[0].inputs
  }

  // Priority 3: Cluster-based defaults
  const defaults = CLUSTER_DEFAULTS[skillDef.cluster]
  if (defaults) {
    return defaults
  }

  throw new TestInputError(
    agentName,
    `No test inputs available for agent "${agentName}"`,
    `Provide inputs via --input flag, add examples to the agent's SKILL.md, or define cluster defaults for "${skillDef.cluster}"`,
  )
}

async function loadInputFile(inputPath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(process.cwd(), inputPath)
  let raw: string

  try {
    raw = await readFile(absolutePath, 'utf-8')
  } catch {
    throw new TestInputError(
      'input-file',
      `Cannot read input file: ${absolutePath}`,
      `Verify the file exists and is readable. Path provided: ${inputPath}`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new TestInputError(
      'input-file',
      `Input file is not valid JSON: ${absolutePath}`,
      'Ensure the file contains a valid JSON object with agent input fields',
    )
  }

  const validated = testInputSchema.safeParse(parsed)
  if (!validated.success) {
    throw new TestInputError(
      'input-file',
      `Input file validation failed: ${validated.error.message}`,
      'Input file must be a JSON object with string keys',
    )
  }

  return validated.data
}
