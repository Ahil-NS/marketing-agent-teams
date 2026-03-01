import {readFile, access} from 'node:fs/promises'
import {join} from 'node:path'
import {parse as parseYaml} from 'yaml'

import {verticalDefinitionSchema} from '../schemas/agent-schema.js'
import type {VerticalDefinitionData} from '../schemas/agent-schema.js'
import {loadKnowledgeDir} from './skill-loader.js'
import {SkillLoadError} from './errors.js'

/**
 * Valid vertical name pattern — kebab-case alphanumeric only.
 * Prevents path traversal (e.g., '../../etc') and invalid directory names.
 */
const VALID_VERTICAL_NAME = /^[a-z\d]+(?:-[a-z\d]+)*$/

/**
 * Loaded vertical module definition — includes parsed manifest and concatenated knowledge context.
 */
export interface VerticalDefinition extends VerticalDefinitionData {
  /** Concatenated knowledge/ file contents — injected into agent system prompts */
  knowledgeContext: string
}

/**
 * Load a vertical module from the verticals root directory.
 * Reads vertical.yaml manifest, validates against schema, and loads knowledge/ files.
 *
 * @param verticalName - Name of the vertical (e.g., 'wellness')
 * @param verticalsRoot - Root directory containing vertical subdirectories
 * @returns Parsed and validated vertical definition with knowledge context
 * @throws SkillLoadError if vertical not found, manifest invalid, or knowledge files unreadable
 */
export async function loadVertical(
  verticalName: string,
  verticalsRoot: string,
): Promise<VerticalDefinition> {
  // Validate vertical name to prevent path traversal
  if (!VALID_VERTICAL_NAME.test(verticalName)) {
    throw new SkillLoadError(
      verticalsRoot,
      'vertical.yaml',
      'VERTICAL_INVALID_NAME',
      `Invalid vertical name: "${verticalName}". Must be kebab-case alphanumeric (e.g., "wellness", "saas", "e-commerce")`,
      'Use only lowercase letters, numbers, and hyphens for vertical names',
    )
  }

  const verticalDir = join(verticalsRoot, verticalName)
  const manifestPath = join(verticalDir, 'vertical.yaml')

  // 1. Check vertical directory exists
  try {
    await access(verticalDir)
  } catch {
    throw new SkillLoadError(
      verticalDir,
      'vertical.yaml',
      'VERTICAL_NOT_FOUND',
      `Vertical "${verticalName}" not found at "${verticalDir}"`,
      `Create a vertical directory at "${verticalDir}" with a vertical.yaml manifest`,
    )
  }

  // 2. Read and parse manifest
  let content: string
  try {
    content = await readFile(manifestPath, 'utf-8')
  } catch {
    throw new SkillLoadError(
      verticalDir,
      'vertical.yaml',
      'VERTICAL_NOT_FOUND',
      `vertical.yaml not found at "${manifestPath}"`,
      `Create a vertical.yaml manifest in "${verticalDir}"`,
    )
  }

  let parsed: unknown
  try {
    parsed = parseYaml(content)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown YAML parse error'
    throw new SkillLoadError(
      verticalDir,
      'vertical.yaml',
      'VERTICAL_VALIDATION_FAILED',
      `Failed to parse vertical.yaml: ${reason}`,
      'Check YAML syntax in vertical.yaml — ensure proper indentation and valid YAML',
    )
  }

  // 3. Validate against schema
  const result = verticalDefinitionSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new SkillLoadError(
      verticalDir,
      'vertical.yaml',
      'VERTICAL_VALIDATION_FAILED',
      `vertical.yaml validation failed:\n${issues}`,
      'Fix the YAML fields listed above. Required: name (string), description (string), version (string)',
    )
  }

  // 4. Load knowledge — use manifest's knowledgeFiles when specified, else load all .md files
  const knowledgeDir = join(verticalDir, 'knowledge')
  let knowledgeContext: string

  if (result.data.knowledgeFiles.length > 0) {
    // Authoritative mode: load only files listed in manifest
    const parts: string[] = []
    for (const file of result.data.knowledgeFiles) {
      const filePath = join(verticalDir, file)
      try {
        const content = await readFile(filePath, 'utf-8')
        parts.push(content)
      } catch {
        throw new SkillLoadError(
          verticalDir,
          file,
          'VERTICAL_KNOWLEDGE_FILE_MISSING',
          `Knowledge file "${file}" listed in vertical.yaml was not found at "${filePath}"`,
          `Create the file at "${filePath}" or remove it from knowledgeFiles in vertical.yaml`,
        )
      }
    }

    knowledgeContext = parts.join('\n\n---\n\n')
  } else {
    // Fallback: load all .md files from knowledge/ directory
    knowledgeContext = await loadKnowledgeDir(knowledgeDir)
  }

  return {
    ...result.data,
    knowledgeContext,
  }
}

/**
 * Get the concatenated knowledge context for a vertical module.
 * Returns empty string if the vertical doesn't exist (verticals are optional).
 *
 * This function is safe to call even when no vertical is configured —
 * it silently returns '' when the vertical directory is missing.
 *
 * @param verticalName - Name of the vertical (e.g., 'wellness')
 * @param verticalsRoot - Root directory containing vertical subdirectories
 * @returns Concatenated vertical knowledge as markdown, or '' if not found
 */
export async function getVerticalContext(
  verticalName: string,
  verticalsRoot: string,
): Promise<string> {
  try {
    const vertical = await loadVertical(verticalName, verticalsRoot)
    return vertical.knowledgeContext
  } catch {
    return ''
  }
}
