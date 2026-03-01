import {readFile, readdir, access} from 'node:fs/promises'
import {join, basename} from 'node:path'
import {parse as parseYaml} from 'yaml'

import {agentDefinitionSchema, CURRENT_SCHEMA_VERSION} from '../schemas/agent-schema.js'
import {SkillLoadError} from './errors.js'
import type {SkillDefinition} from './types.js'

/**
 * Parse SKILL.md content into YAML front matter and markdown body.
 * Front matter is delimited by --- lines at the start of the file.
 */
export function parseSkillMd(
  content: string,
  agentPath: string,
): {frontMatter: Record<string, unknown>; body: string} {
  const trimmed = content.trimStart()

  if (!trimmed.startsWith('---')) {
    throw new SkillLoadError(
      agentPath,
      'frontMatter',
      'SKILL_PARSE_FAILED',
      'SKILL.md must start with YAML front matter delimited by --- lines',
      'Add --- delimiters around YAML front matter at the top of SKILL.md',
    )
  }

  // Find closing --- that appears at the start of a line (not inside a YAML value)
  const secondDelimiter = trimmed.indexOf('\n---', 3)
  if (secondDelimiter === -1) {
    throw new SkillLoadError(
      agentPath,
      'frontMatter',
      'SKILL_PARSE_FAILED',
      'SKILL.md is missing the closing --- delimiter for YAML front matter',
      'Add a closing --- line after the YAML front matter block',
    )
  }

  const yamlBlock = trimmed.slice(3, secondDelimiter).trim()
  const body = trimmed.slice(secondDelimiter + 4).trim()

  try {
    const parsed = parseYaml(yamlBlock) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('YAML front matter did not parse to an object')
    }

    return {frontMatter: parsed, body}
  } catch (error) {
    if (error instanceof SkillLoadError) throw error
    const reason = error instanceof Error ? error.message : 'Unknown YAML parse error'
    throw new SkillLoadError(
      agentPath,
      'frontMatter',
      'SKILL_PARSE_FAILED',
      `Failed to parse YAML front matter: ${reason}`,
      'Check YAML syntax in SKILL.md front matter — ensure proper indentation and valid YAML',
    )
  }
}

/**
 * Load and concatenate all .md files from a knowledge/ directory.
 * Returns empty string if directory does not exist.
 * Files are sorted alphabetically for deterministic order.
 */
export async function loadKnowledgeDir(knowledgePath: string): Promise<string> {
  try {
    await access(knowledgePath)
  } catch {
    return '' // knowledge/ directory is optional
  }

  let entries: string[]
  try {
    entries = await readdir(knowledgePath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown read error'
    throw new SkillLoadError(
      knowledgePath,
      'knowledge',
      'SKILL_KNOWLEDGE_READ_FAILED',
      `Failed to read knowledge directory: ${reason}`,
      `Check that the knowledge/ directory at "${knowledgePath}" is readable`,
    )
  }

  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort()

  if (mdFiles.length === 0) {
    return ''
  }

  const parts: string[] = []
  for (const file of mdFiles) {
    try {
      const content = await readFile(join(knowledgePath, file), 'utf-8')
      parts.push(content)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown read error'
      throw new SkillLoadError(
        knowledgePath,
        `knowledge/${file}`,
        'SKILL_KNOWLEDGE_READ_FAILED',
        `Failed to read knowledge file "${file}": ${reason}`,
        `Check that ${file} exists and is readable in the knowledge/ directory`,
      )
    }
  }

  return parts.join('\n\n---\n\n')
}

/**
 * Load all .md files from a templates/ directory into a Map.
 * Returns empty Map if directory does not exist.
 * Keys are filenames without .md extension.
 */
export async function loadTemplatesDir(
  templatesPath: string,
): Promise<Map<string, string>> {
  const templates = new Map<string, string>()

  try {
    await access(templatesPath)
  } catch {
    return templates // templates/ directory is optional
  }

  let entries: string[]
  try {
    entries = await readdir(templatesPath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown read error'
    throw new SkillLoadError(
      templatesPath,
      'templates',
      'SKILL_TEMPLATE_READ_FAILED',
      `Failed to read templates directory: ${reason}`,
      `Check that the templates/ directory at "${templatesPath}" is readable`,
    )
  }

  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort()

  for (const file of mdFiles) {
    try {
      const content = await readFile(join(templatesPath, file), 'utf-8')
      const name = basename(file, '.md')
      templates.set(name, content)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown read error'
      throw new SkillLoadError(
        templatesPath,
        `templates/${file}`,
        'SKILL_TEMPLATE_READ_FAILED',
        `Failed to read template file "${file}": ${reason}`,
        `Check that ${file} exists and is readable in the templates/ directory`,
      )
    }
  }

  return templates
}

/**
 * Load a complete agent skill definition from a directory containing SKILL.md.
 * Reads SKILL.md, validates front matter, loads knowledge/ and templates/.
 */
export async function loadSkill(agentDir: string): Promise<SkillDefinition> {
  const skillPath = join(agentDir, 'SKILL.md')

  // 1. Read SKILL.md
  let content: string
  try {
    content = await readFile(skillPath, 'utf-8')
  } catch {
    throw new SkillLoadError(
      agentDir,
      'SKILL.md',
      'SKILL_NOT_FOUND',
      `SKILL.md not found at "${skillPath}"`,
      `Create a SKILL.md file in "${agentDir}" with YAML front matter (name, description, cluster) and a markdown body`,
    )
  }

  // 2. Parse front matter and body
  const {frontMatter, body} = parseSkillMd(content, agentDir)

  // 3. Validate front matter against schema
  const result = agentDefinitionSchema.safeParse(frontMatter)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new SkillLoadError(
      agentDir,
      'frontMatter',
      'SKILL_VALIDATION_FAILED',
      `SKILL.md front matter validation failed:\n${issues}`,
      'Fix the YAML front matter fields listed above. Required: name (string), description (string), cluster (one of: intelligence, strategy, creation, optimization, quality, distribution, coordination)',
    )
  }

  // 3b. Version compatibility check
  const loadedMajor = result.data.schemaVersion.split('.')[0]
  const currentMajor = CURRENT_SCHEMA_VERSION.split('.')[0]
  if (loadedMajor !== currentMajor) {
    console.warn(
      `[WARN] SKILL.md at "${agentDir}" uses schema version ${result.data.schemaVersion} but current is ${CURRENT_SCHEMA_VERSION}. ` +
      `Major version mismatch — see docs/schema-migrations/ for migration guides.`,
    )
  }

  // 4. Load knowledge directory
  const knowledgeContext = await loadKnowledgeDir(join(agentDir, 'knowledge'))

  // 5. Load templates directory
  const templatesMap = await loadTemplatesDir(join(agentDir, 'templates'))

  // 6. Convert Map to Record for SkillDefinition
  const templates: Record<string, string> = {}
  for (const [key, value] of templatesMap) {
    templates[key] = value
  }

  // 7. Assemble SkillDefinition
  return {
    name: result.data.name,
    description: result.data.description,
    cluster: result.data.cluster,
    model: result.data.model,
    tools: result.data.tools,
    trustTier: result.data.trustTier,
    schemaVersion: result.data.schemaVersion,
    permissions: result.data.permissions,
    systemPrompt: body,
    knowledgeContext,
    templates,
    examples: result.data.examples,
  }
}

/**
 * Resolve an agent name (e.g., "trend-scout") to its directory path.
 * Searches across all cluster directories under the agents root.
 * Returns the full path to the agent directory containing SKILL.md.
 */
export async function resolveAgentDir(agentName: string): Promise<string> {
  const agentsRoot = join(process.cwd(), 'src', 'agents')

  let clusterEntries: import('node:fs').Dirent[]
  try {
    clusterEntries = await readdir(agentsRoot, {withFileTypes: true})
  } catch {
    throw new SkillLoadError(
      agentsRoot,
      'resolveAgentDir',
      'SKILL_NOT_FOUND',
      `Agents root directory not found at "${agentsRoot}"`,
      'Ensure you are running from the project root directory',
    )
  }

  for (const clusterEntry of clusterEntries.filter((e) => e.isDirectory())) {
    const candidatePath = join(agentsRoot, clusterEntry.name, agentName)
    try {
      await access(join(candidatePath, 'SKILL.md'))
      return candidatePath
    } catch {
      continue
    }
  }

  throw new SkillLoadError(
    agentsRoot,
    agentName,
    'SKILL_NOT_FOUND',
    `No SKILL.md definition exists for agent "${agentName}" in src/agents/`,
    'Run `mat agents list` to see available agents. Agent names use kebab-case (e.g., trend-scout, content-strategist)',
  )
}

/**
 * Load all agent skills from the agents root directory.
 * Scans for <cluster>/<agent-name>/SKILL.md pattern.
 * Returns a Map keyed by agent name.
 */
export async function loadAllSkills(
  agentsRoot: string,
): Promise<Map<string, SkillDefinition>> {
  const skills = new Map<string, SkillDefinition>()
  const errors: SkillLoadError[] = []

  const clusterEntries = await readdir(agentsRoot, {withFileTypes: true})
  for (const clusterEntry of clusterEntries.filter((e) => e.isDirectory())) {
    const clusterPath = join(agentsRoot, clusterEntry.name)
    const agentEntries = await readdir(clusterPath, {withFileTypes: true})

    for (const agentEntry of agentEntries.filter((e) => e.isDirectory())) {
      const agentDir = join(clusterPath, agentEntry.name)
      const skillPath = join(agentDir, 'SKILL.md')

      // Check if SKILL.md exists before attempting to load
      try {
        await access(skillPath)
      } catch {
        continue // Skip directories without SKILL.md
      }

      try {
        const skill = await loadSkill(agentDir)
        skills.set(skill.name, skill)
      } catch (error) {
        if (error instanceof SkillLoadError) {
          errors.push(error)
        } else {
          throw error
        }
      }
    }
  }

  if (errors.length > 0) {
    const summary = errors
      .map((e) => `  - ${e.source}: ${e.reason}`)
      .join('\n')
    throw new SkillLoadError(
      agentsRoot,
      'multiple',
      'SKILL_VALIDATION_FAILED',
      `${errors.length} agent skill(s) failed to load:\n${summary}`,
      'Fix the errors listed above in each agent\'s SKILL.md file',
    )
  }

  return skills
}
