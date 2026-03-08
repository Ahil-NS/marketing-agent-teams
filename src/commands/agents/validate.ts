import {join} from 'node:path'
import {readFile, readdir, access} from 'node:fs/promises'

import {Command, Flags} from '@oclif/core'

import {agentDefinitionSchema} from '../../lib/schemas/agent-schema.js'
import {parseSkillMd} from '../../lib/agents/skill-loader.js'
import {validateSkillMdSafety} from '../../lib/agents/sandbox-validator.js'
import {agentsRoot} from '../../lib/agents/paths.js'

export interface ValidateResult {
  agent: string
  valid: boolean
  schemaVersion?: string
  errors: string[]
}

export default class AgentsValidate extends Command {
  static override description = 'Validate agent SKILL.md files against the schema and sandbox rules'

  static enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> agents validate',
    '<%= config.bin %> agents validate --path src/agents/intelligence/trend-scout',
    '<%= config.bin %> agents validate --json',
  ]

  static override flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to a specific agent directory containing SKILL.md',
    }),
  }

  async run(): Promise<Record<string, unknown> | void> {
    const {flags} = await this.parse(AgentsValidate)

    let agentDirs: string[]

    if (flags.path) {
      agentDirs = [flags.path]
    } else {
      agentDirs = await this.discoverAgentDirs()
    }

    const results: ValidateResult[] = []
    let hasFailures = false

    for (const dir of agentDirs) {
      const result = await this.validateAgent(dir)
      results.push(result)
      if (!result.valid) {
        hasFailures = true
      }
    }

    if (flags.json) {
      return {results, valid: !hasFailures} as unknown as Record<string, unknown>
    }

    // Display results
    for (const result of results) {
      if (result.valid) {
        const versionInfo = result.schemaVersion ? ` (schema ${result.schemaVersion})` : ''
        this.log(`✓ ${result.agent} — valid${versionInfo}`)
      } else {
        this.log(`✗ ${result.agent} — ${result.errors.length} error(s)`)
        for (const error of result.errors) {
          this.log(`  - ${error}`)
        }
      }
    }

    this.log('')
    const passed = results.filter((r) => r.valid).length
    const failed = results.filter((r) => !r.valid).length
    this.log(`${passed} passed, ${failed} failed out of ${results.length} agent(s)`)

    if (hasFailures) {
      this.exit(1)
    }
  }

  /**
   * Discover all agent directories under src/agents/<cluster>/<agent-name>/
   */
  private async discoverAgentDirs(): Promise<string[]> {
    const agentsRootDir = agentsRoot()
    const dirs: string[] = []

    let clusterEntries: string[]
    try {
      const entries = await readdir(agentsRootDir)
      clusterEntries = entries.filter((name) => !name.startsWith('.'))
    } catch {
      this.error(`Could not read agents directory at "${agentsRootDir}". Ensure the package is installed correctly.`, {exit: 1})
    }

    for (const clusterName of clusterEntries) {
      const clusterPath = join(agentsRootDir, clusterName)
      let agentEntries: string[]
      try {
        agentEntries = await readdir(clusterPath)
      } catch {
        continue
      }

      for (const agentName of agentEntries.filter((n) => !n.startsWith('.'))) {
        const agentDir = join(clusterPath, agentName)
        const skillPath = join(agentDir, 'SKILL.md')

        try {
          await access(skillPath)
          dirs.push(agentDir)
        } catch {
          // Skip directories without SKILL.md
        }
      }
    }

    return dirs
  }

  /**
   * Validate a single agent directory.
   */
  private async validateAgent(agentDir: string): Promise<ValidateResult> {
    const agentName = agentDir.split('/').pop() ?? agentDir
    const errors: string[] = []

    // 1. Read SKILL.md
    const skillPath = join(agentDir, 'SKILL.md')
    let content: string
    try {
      content = await readFile(skillPath, 'utf-8')
    } catch {
      return {agent: agentName, valid: false, errors: ['SKILL.md not found']}
    }

    // 2. Sandbox validation
    const sandboxResult = validateSkillMdSafety(content)
    if (!sandboxResult.safe) {
      for (const finding of sandboxResult.findings.filter((f) => f.severity === 'error')) {
        errors.push(`[sandbox] Line ${finding.line}: ${finding.message}`)
      }
    }

    // 3. Parse front matter
    let frontMatter: Record<string, unknown>
    try {
      const parsed = parseSkillMd(content, agentDir)
      frontMatter = parsed.frontMatter
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`[parse] ${msg}`)
      return {agent: agentName, valid: false, errors}
    }

    // 4. Schema validation
    const result = agentDefinitionSchema.safeParse(frontMatter)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`)
      }
    }

    // 5. Line count check (< 500 lines)
    const lineCount = content.split('\n').length
    if (lineCount >= 500) {
      errors.push(`SKILL.md has ${lineCount} lines (limit: 500). Consider splitting into knowledge/ files.`)
    }

    // 6. Trigger phrase check — description should contain actionable phrases
    if (result.success) {
      const desc = result.data.description ?? ''
      const words = desc.trim().split(/\s+/)
      if (words.length < 5) {
        errors.push(`Description too short (${words.length} words). Add trigger phrases describing what this agent does.`)
      }
    }

    const schemaVersion = result.success ? result.data.schemaVersion : undefined

    return {
      agent: agentName,
      valid: errors.length === 0,
      schemaVersion,
      errors,
    }
  }
}
