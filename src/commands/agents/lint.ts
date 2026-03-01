import {join} from 'node:path'
import {readdir, access} from 'node:fs/promises'

import {Command, Flags} from '@oclif/core'

import {runSecurityLint} from '../../lib/agents/security-lint.js'
import type {SecurityLintResult, SecurityLintFinding} from '../../lib/agents/security-lint.js'

export default class AgentsLint extends Command {
  static override description = 'Run security lint on agent SKILL.md definitions'

  static enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> agents lint',
    '<%= config.bin %> agents lint --path src/agents/intelligence/trend-scout',
    '<%= config.bin %> agents lint --format json',
    '<%= config.bin %> agents lint --format github',
  ]

  static override flags = {
    format: Flags.string({
      char: 'f',
      description: 'Output format: default (human-readable), json (machine-readable), github (GitHub Actions annotations)',
      options: ['default', 'json', 'github'],
      default: 'default',
    }),
    path: Flags.string({
      char: 'p',
      description: 'Path to a specific agent directory containing SKILL.md',
    }),
  }

  async run(): Promise<Record<string, unknown> | void> {
    const {flags} = await this.parse(AgentsLint)

    let agentDirs: string[]

    if (flags.path) {
      agentDirs = [flags.path]
    } else {
      agentDirs = await this.discoverAgentDirs()
    }

    if (agentDirs.length === 0) {
      this.log('No agent directories found.')
      return
    }

    const allFindings: SecurityLintFinding[] = []
    let totalFilesScanned = 0
    let totalRulesApplied = 0
    const results: Array<{agent: string; result: SecurityLintResult}> = []

    for (const dir of agentDirs) {
      const agentName = dir.split('/').pop() ?? dir
      const result = await runSecurityLint(dir)
      results.push({agent: agentName, result})
      allFindings.push(...result.findings.map((f) => ({
        ...f,
        file: `${agentName}/${f.file}`,
      })))
      totalFilesScanned += result.filesScanned
      totalRulesApplied = Math.max(totalRulesApplied, result.rulesApplied)
    }

    const hasErrors = allFindings.some((f) => f.severity === 'error')

    // Format output
    if (flags.format === 'json' || flags.json) {
      const jsonResult = {
        safe: !hasErrors,
        findings: allFindings,
        filesScanned: totalFilesScanned,
        rulesApplied: totalRulesApplied,
        agents: results.map(({agent, result}) => ({
          agent,
          safe: result.safe,
          findingCount: result.findings.length,
        })),
      }

      if (flags.json) {
        return jsonResult as unknown as Record<string, unknown>
      }

      this.log(JSON.stringify(jsonResult, null, 2))
    } else if (flags.format === 'github') {
      for (const finding of allFindings) {
        const level = finding.severity === 'error' ? 'error' : 'warning'
        this.log(`::${level} file=${finding.file},line=${finding.line}::${finding.message}`)
      }
    } else {
      // Default human-readable format
      for (const {agent, result} of results) {
        if (result.findings.length === 0) {
          this.log(`✓ ${agent} — no findings`)
        } else {
          const errorCount = result.findings.filter((f) => f.severity === 'error').length
          const warnCount = result.findings.filter((f) => f.severity === 'warning').length
          this.log(`✗ ${agent} — ${errorCount} error(s), ${warnCount} warning(s)`)

          for (const finding of result.findings) {
            const icon = finding.severity === 'error' ? '✗' : '⚠'
            this.log(`  ${icon} [${finding.rule}] ${finding.file}:${finding.line} — ${finding.message}`)
            this.log(`    Remediation: ${finding.remediation}`)
          }
        }
      }

      this.log('')
      const passed = results.filter(({result}) => result.safe).length
      const failed = results.filter(({result}) => !result.safe).length
      this.log(`${passed} passed, ${failed} failed out of ${results.length} agent(s)`)
      this.log(`${totalFilesScanned} file(s) scanned`)
    }

    if (hasErrors) {
      this.exit(1)
    }
  }

  /**
   * Discover all agent directories under src/agents/<cluster>/<agent-name>/
   */
  private async discoverAgentDirs(): Promise<string[]> {
    const agentsRoot = join(process.cwd(), 'src', 'agents')
    const dirs: string[] = []

    let clusterEntries: string[]
    try {
      const entries = await readdir(agentsRoot)
      clusterEntries = entries.filter((name) => !name.startsWith('.'))
    } catch {
      this.error('Could not read src/agents/ directory. Are you in the project root?', {exit: 1})
    }

    for (const clusterName of clusterEntries) {
      const clusterPath = join(agentsRoot, clusterName)
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
}
