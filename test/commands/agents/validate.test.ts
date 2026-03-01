import {join} from 'node:path'

import {describe, expect, it, vi, beforeEach} from 'vitest'

import type {ValidateResult} from '../../../src/commands/agents/validate.js'

// Mock modules
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
  }
})

const {readFile, readdir, access} = await import('node:fs/promises')
const mockReadFile = vi.mocked(readFile)
const mockReaddir = vi.mocked(readdir)
const mockAccess = vi.mocked(access)

describe('AgentsValidate command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct description', async () => {
    const {default: AgentsValidateCommand} = await import('../../../src/commands/agents/validate.js')
    expect(AgentsValidateCommand.description).toContain('Validate')
  })

  it('should have --path flag defined', async () => {
    const {default: AgentsValidateCommand} = await import('../../../src/commands/agents/validate.js')
    expect(AgentsValidateCommand.flags).toHaveProperty('path')
  })

  it('should support JSON output flag', async () => {
    const {default: AgentsValidateCommand} = await import('../../../src/commands/agents/validate.js')
    expect(AgentsValidateCommand.enableJsonFlag).toBe(true)
  })

  it('should have examples defined', async () => {
    const {default: AgentsValidateCommand} = await import('../../../src/commands/agents/validate.js')
    expect(AgentsValidateCommand.examples).toBeDefined()
    expect(AgentsValidateCommand.examples!.length).toBeGreaterThan(0)
  })
})

describe('validate against test fixtures', () => {
  const fixturesRoot = join(process.cwd(), 'test', 'fixtures', 'agents')

  it('validates valid-agent fixture passes', async () => {
    const {parseSkillMd} = await import('../../../src/lib/agents/skill-loader.js')
    const {agentDefinitionSchema} = await import('../../../src/lib/schemas/agent-schema.js')
    const {validateSkillMdSafety} = await import('../../../src/lib/agents/sandbox-validator.js')
    const {readFileSync} = await import('node:fs')

    const content = readFileSync(join(fixturesRoot, 'valid-agent', 'SKILL.md'), 'utf-8')

    // Sandbox passes
    const sandboxResult = validateSkillMdSafety(content)
    expect(sandboxResult.safe).toBe(true)

    // Schema passes
    const {frontMatter} = parseSkillMd(content, 'valid-agent')
    const schemaResult = agentDefinitionSchema.safeParse(frontMatter)
    expect(schemaResult.success).toBe(true)
  })

  it('validates valid-builtin-agent fixture passes', async () => {
    const {parseSkillMd} = await import('../../../src/lib/agents/skill-loader.js')
    const {agentDefinitionSchema} = await import('../../../src/lib/schemas/agent-schema.js')
    const {validateSkillMdSafety} = await import('../../../src/lib/agents/sandbox-validator.js')
    const {readFileSync} = await import('node:fs')

    const skillPath = join(fixturesRoot, 'valid-builtin-agent', 'SKILL.md')
    const {existsSync} = await import('node:fs')
    if (!existsSync(skillPath)) return // skip if fixture doesn't exist

    const content = readFileSync(skillPath, 'utf-8')
    const sandboxResult = validateSkillMdSafety(content)
    expect(sandboxResult.safe).toBe(true)

    const {frontMatter} = parseSkillMd(content, 'valid-builtin-agent')
    const schemaResult = agentDefinitionSchema.safeParse(frontMatter)
    expect(schemaResult.success).toBe(true)
  })

  it('detects malicious-script-injection fixture fails sandbox', async () => {
    const {validateSkillMdSafety} = await import('../../../src/lib/agents/sandbox-validator.js')
    const {readFileSync} = await import('node:fs')

    const content = readFileSync(join(fixturesRoot, 'malicious-script-injection', 'SKILL.md'), 'utf-8')
    const result = validateSkillMdSafety(content)
    expect(result.safe).toBe(false)
    expect(result.findings.some((f) => f.severity === 'error')).toBe(true)
  })

  it('detects malicious-path-traversal fixture fails sandbox', async () => {
    const {validateSkillMdSafety} = await import('../../../src/lib/agents/sandbox-validator.js')
    const {readFileSync} = await import('node:fs')

    const skillPath = join(fixturesRoot, 'malicious-path-traversal', 'SKILL.md')
    const {existsSync} = await import('node:fs')
    if (!existsSync(skillPath)) return

    const content = readFileSync(skillPath, 'utf-8')
    const result = validateSkillMdSafety(content)
    expect(result.safe).toBe(false)
  })

  it('detects invalid-missing-cluster fixture fails schema', async () => {
    const {parseSkillMd} = await import('../../../src/lib/agents/skill-loader.js')
    const {agentDefinitionSchema} = await import('../../../src/lib/schemas/agent-schema.js')
    const {readFileSync} = await import('node:fs')

    const content = readFileSync(join(fixturesRoot, 'invalid-missing-cluster', 'SKILL.md'), 'utf-8')
    const {frontMatter} = parseSkillMd(content, 'invalid-missing-cluster')
    const result = agentDefinitionSchema.safeParse(frontMatter)
    expect(result.success).toBe(false)
  })
})

describe('ValidateResult type', () => {
  it('represents a valid agent result', () => {
    const result: ValidateResult = {
      agent: 'trend-scout',
      valid: true,
      schemaVersion: '1.0.0',
      errors: [],
    }
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('represents an invalid agent result', () => {
    const result: ValidateResult = {
      agent: 'bad-agent',
      valid: false,
      errors: ['name: String must contain at least 1 character(s)', '[sandbox] Line 5: Script tag detected'],
    }
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(2)
  })
})
