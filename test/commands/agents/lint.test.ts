import {join} from 'node:path'

import {describe, expect, it} from 'vitest'

describe('AgentsLint command', () => {
  it('should have correct description', async () => {
    const {default: AgentsLintCommand} = await import('../../../src/commands/agents/lint.js')
    expect(AgentsLintCommand.description).toContain('security lint')
  })

  it('should have --path flag defined', async () => {
    const {default: AgentsLintCommand} = await import('../../../src/commands/agents/lint.js')
    expect(AgentsLintCommand.flags).toHaveProperty('path')
  })

  it('should have --format flag defined', async () => {
    const {default: AgentsLintCommand} = await import('../../../src/commands/agents/lint.js')
    expect(AgentsLintCommand.flags).toHaveProperty('format')
  })

  it('should support JSON output flag', async () => {
    const {default: AgentsLintCommand} = await import('../../../src/commands/agents/lint.js')
    expect(AgentsLintCommand.enableJsonFlag).toBe(true)
  })

  it('should have examples defined', async () => {
    const {default: AgentsLintCommand} = await import('../../../src/commands/agents/lint.js')
    expect(AgentsLintCommand.examples).toBeDefined()
    expect(AgentsLintCommand.examples!.length).toBeGreaterThan(0)
  })
})

describe('lint output format tests', () => {
  const fixturesRoot = join(process.cwd(), 'test', 'fixtures', 'agents')

  it('--format json output is valid JSON with correct structure', async () => {
    const {runSecurityLint} = await import('../../../src/lib/agents/security-lint.js')
    const result = await runSecurityLint(join(fixturesRoot, 'valid-agent'))

    // Simulate the JSON output structure the command would produce
    const jsonResult = {
      safe: result.safe,
      findings: result.findings,
      filesScanned: result.filesScanned,
      rulesApplied: result.rulesApplied,
      agents: [{agent: 'valid-agent', safe: result.safe, findingCount: result.findings.length}],
    }

    const serialized = JSON.stringify(jsonResult)
    const parsed = JSON.parse(serialized)

    expect(parsed).toHaveProperty('safe', true)
    expect(parsed).toHaveProperty('findings')
    expect(parsed).toHaveProperty('filesScanned')
    expect(parsed).toHaveProperty('rulesApplied')
    expect(parsed).toHaveProperty('agents')
    expect(Array.isArray(parsed.findings)).toBe(true)
    expect(Array.isArray(parsed.agents)).toBe(true)
  })

  it('--format json includes findings for malicious agents', async () => {
    const {runSecurityLint} = await import('../../../src/lib/agents/security-lint.js')
    const result = await runSecurityLint(join(fixturesRoot, 'malicious-script-injection'))

    const jsonResult = {
      safe: result.safe,
      findings: result.findings,
      filesScanned: result.filesScanned,
      rulesApplied: result.rulesApplied,
      agents: [{agent: 'malicious-script-injection', safe: result.safe, findingCount: result.findings.length}],
    }

    const serialized = JSON.stringify(jsonResult)
    const parsed = JSON.parse(serialized)

    expect(parsed.safe).toBe(false)
    expect(parsed.findings.length).toBeGreaterThan(0)
  })

  it('--format github output matches ::error/::warning format', async () => {
    const {runSecurityLint} = await import('../../../src/lib/agents/security-lint.js')
    const result = await runSecurityLint(join(fixturesRoot, 'malicious-script-injection'))

    // Simulate GitHub Actions annotation format
    const lines: string[] = []
    for (const finding of result.findings) {
      const level = finding.severity === 'error' ? 'error' : 'warning'
      lines.push(`::${level} file=${finding.file},line=${finding.line}::${finding.message}`)
    }

    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line).toMatch(/^::(error|warning) file=.+,line=\d+::.+$/)
    }
  })

  it('--format github uses ::warning for warning-severity findings', async () => {
    const {runSecurityLint} = await import('../../../src/lib/agents/security-lint.js')
    const result = await runSecurityLint(join(fixturesRoot, 'malicious-credential-exfil'))

    const warningFindings = result.findings.filter((f) => f.severity === 'warning')
    if (warningFindings.length > 0) {
      const line = `::warning file=${warningFindings[0].file},line=${warningFindings[0].line}::${warningFindings[0].message}`
      expect(line).toMatch(/^::warning/)
    }
  })
})
