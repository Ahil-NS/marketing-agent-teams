import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {describe, it, expect} from 'vitest'

import {loadSkill, loadAllSkills, parseSkillMd, loadKnowledgeDir, loadTemplatesDir} from '../../../src/lib/agents/skill-loader.js'
import {SkillLoadError} from '../../../src/lib/agents/errors.js'

const FIXTURES = join(import.meta.dirname, '../../fixtures/skills')

describe('parseSkillMd', () => {
  it('extracts YAML front matter and markdown body', () => {
    const content = `---
name: test
description: A test agent
cluster: intelligence
---

# Test Agent

You are a test agent.`

    const result = parseSkillMd(content, '/test')
    expect(result.frontMatter).toEqual({
      name: 'test',
      description: 'A test agent',
      cluster: 'intelligence',
    })
    expect(result.body).toBe('# Test Agent\n\nYou are a test agent.')
  })

  it('throws SKILL_PARSE_FAILED when missing opening ---', () => {
    const content = `name: test
description: test
cluster: intelligence
---

# Body`

    expect(() => parseSkillMd(content, '/test')).toThrow(SkillLoadError)
    try {
      parseSkillMd(content, '/test')
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('SKILL_PARSE_FAILED')
    }
  })

  it('throws SKILL_PARSE_FAILED when missing closing ---', () => {
    const content = `---
name: test
description: test
cluster: intelligence

# Body with no closing delimiter`

    expect(() => parseSkillMd(content, '/test')).toThrow(SkillLoadError)
    try {
      parseSkillMd(content, '/test')
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('SKILL_PARSE_FAILED')
    }
  })

  it('throws SKILL_PARSE_FAILED on malformed YAML', () => {
    const content = `---
name: test
description: [invalid: yaml: {nesting
cluster: intelligence
---

# Body`

    expect(() => parseSkillMd(content, '/test')).toThrow(SkillLoadError)
    try {
      parseSkillMd(content, '/test')
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('SKILL_PARSE_FAILED')
    }
  })

  it('handles leading whitespace before front matter', () => {
    const content = `
---
name: test
description: A test
cluster: intelligence
---

# Body`

    const result = parseSkillMd(content, '/test')
    expect(result.frontMatter.name).toBe('test')
    expect(result.body).toBe('# Body')
  })
})

describe('loadKnowledgeDir', () => {
  it('concatenates all .md files separated by ---', async () => {
    const knowledgePath = join(FIXTURES, 'valid-agent/knowledge')
    const result = await loadKnowledgeDir(knowledgePath)

    expect(result).toContain('Best Practices')
    expect(result).toContain('Domain Guide')
    expect(result).toContain('\n\n---\n\n')
  })

  it('sorts files alphabetically for deterministic order', async () => {
    const knowledgePath = join(FIXTURES, 'valid-agent/knowledge')
    const result = await loadKnowledgeDir(knowledgePath)

    // best-practices.md comes before domain-guide.md alphabetically
    const bestIdx = result.indexOf('Best Practices')
    const domainIdx = result.indexOf('Domain Guide')
    expect(bestIdx).toBeLessThan(domainIdx)
  })

  it('returns empty string when directory does not exist', async () => {
    const result = await loadKnowledgeDir('/nonexistent/knowledge/path')
    expect(result).toBe('')
  })

  it('returns empty string for directory with no .md files', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'mat-test-'))
    try {
      await writeFile(join(tmpDir, 'notes.txt'), 'not a markdown file')
      const result = await loadKnowledgeDir(tmpDir)
      expect(result).toBe('')
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  it('ignores non-.md files in knowledge directory', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'mat-test-'))
    try {
      await writeFile(join(tmpDir, 'notes.txt'), 'This should be ignored')
      await writeFile(join(tmpDir, 'data.json'), '{"ignored": true}')
      await writeFile(join(tmpDir, 'readme.md'), '# Only this should load')
      const result = await loadKnowledgeDir(tmpDir)
      expect(result).toBe('# Only this should load')
      expect(result).not.toContain('ignored')
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})

describe('loadTemplatesDir', () => {
  it('loads templates as Map with name (no .md) -> content', async () => {
    const templatesPath = join(FIXTURES, 'valid-agent/templates')
    const result = await loadTemplatesDir(templatesPath)

    expect(result).toBeInstanceOf(Map)
    expect(result.has('output-format')).toBe(true)
    expect(result.get('output-format')).toContain('Output Format Template')
  })

  it('returns empty Map when directory does not exist', async () => {
    const result = await loadTemplatesDir('/nonexistent/templates/path')
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })
})

describe('loadSkill', () => {
  it('loads complete SkillDefinition from valid agent directory', async () => {
    const skill = await loadSkill(join(FIXTURES, 'valid-agent'))
    expect(skill.name).toBe('test-agent')
    expect(skill.cluster).toBe('intelligence')
    expect(skill.model).toBe('haiku')
    expect(skill.tools).toContain('WebSearch')
    expect(skill.tools).toContain('WebFetch')
    expect(skill.systemPrompt).toContain('You are a test agent')
    expect(skill.knowledgeContext).toContain('Best Practices')
    expect(skill.knowledgeContext).toContain('Domain Guide')
    expect(skill.templates['output-format']).toBeDefined()
    expect(skill.permissions.credentials).toEqual([])
    expect(skill.permissions.dataScopes).toContain('brand-config')
    expect(skill.permissions.toolScopes).toContain('WebSearch')
  })

  it('loads minimal SkillDefinition with defaults applied', async () => {
    const skill = await loadSkill(join(FIXTURES, 'minimal-agent'))
    expect(skill.name).toBe('minimal-agent')
    expect(skill.model).toBe('haiku')          // default
    expect(skill.tools).toEqual([])             // default
    expect(skill.trustTier).toBe('builtin')     // default
    expect(skill.knowledgeContext).toBe('')       // no knowledge dir
    expect(Object.keys(skill.templates).length).toBe(0) // no templates dir
    expect(skill.permissions.credentials).toEqual([])  // default
    expect(skill.permissions.dataScopes).toEqual([])   // default
    expect(skill.permissions.toolScopes).toEqual([])   // default
  })

  it('throws SKILL_NOT_FOUND when SKILL.md is missing', async () => {
    await expect(loadSkill('/nonexistent/path'))
      .rejects.toThrow(SkillLoadError)
    await expect(loadSkill('/nonexistent/path'))
      .rejects.toMatchObject({code: 'SKILL_NOT_FOUND'})
  })

  it('throws SKILL_VALIDATION_FAILED when required fields missing', async () => {
    await expect(loadSkill(join(FIXTURES, 'missing-fields')))
      .rejects.toThrow(SkillLoadError)
    await expect(loadSkill(join(FIXTURES, 'missing-fields')))
      .rejects.toMatchObject({code: 'SKILL_VALIDATION_FAILED'})
  })

  it('throws SKILL_PARSE_FAILED on malformed YAML', async () => {
    await expect(loadSkill(join(FIXTURES, 'invalid-yaml')))
      .rejects.toThrow(SkillLoadError)
    await expect(loadSkill(join(FIXTURES, 'invalid-yaml')))
      .rejects.toMatchObject({code: 'SKILL_PARSE_FAILED'})
  })

  it('SkillLoadError includes NFR27 three-part message', async () => {
    try {
      await loadSkill('/nonexistent/path')
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      const skillError = error as SkillLoadError
      expect(skillError.message).toBeTruthy()     // what happened
      expect(skillError.reason).toBeTruthy()       // why
      expect(skillError.resolution).toBeTruthy()   // how to fix
    }
  })

  it('strips YAML front matter from systemPrompt', async () => {
    const skill = await loadSkill(join(FIXTURES, 'valid-agent'))
    expect(skill.systemPrompt).not.toContain('---')
    expect(skill.systemPrompt).not.toContain('name:')
    expect(skill.systemPrompt).not.toContain('cluster:')
  })

  it('extracts permissions with credentials, dataScopes, toolScopes', async () => {
    const skill = await loadSkill(join(FIXTURES, 'valid-agent'))
    expect(skill.permissions).toHaveProperty('credentials')
    expect(skill.permissions).toHaveProperty('dataScopes')
    expect(skill.permissions).toHaveProperty('toolScopes')
    expect(Array.isArray(skill.permissions.credentials)).toBe(true)
    expect(Array.isArray(skill.permissions.dataScopes)).toBe(true)
    expect(Array.isArray(skill.permissions.toolScopes)).toBe(true)
  })

  it('loads agent without knowledge directory (optional)', async () => {
    const skill = await loadSkill(join(FIXTURES, 'no-knowledge'))
    expect(skill.name).toBe('no-knowledge-agent')
    expect(skill.knowledgeContext).toBe('')
    expect(skill.model).toBe('sonnet')
  })
})

describe('loadAllSkills', () => {
  it('loads all valid skills from a directory tree', async () => {
    // Create a temporary structure using the fixtures
    // The fixtures have skills at flat level, not cluster/agent, so we test with src/agents
    const agentsRoot = join(import.meta.dirname, '../../../src/agents')
    const skills = await loadAllSkills(agentsRoot)

    expect(skills).toBeInstanceOf(Map)
    expect(skills.size).toBeGreaterThan(0)

    // Verify each skill has required fields
    for (const [name, skill] of skills) {
      expect(name).toBe(skill.name)
      expect(skill.description).toBeTruthy()
      expect(skill.cluster).toBeTruthy()
      expect(skill.systemPrompt).toBeTruthy()
    }
  })

  it('throws aggregate error when skills fail to load', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'mat-test-'))
    try {
      await mkdir(join(tmpDir, 'test-cluster/valid-agent'), {recursive: true})
      await mkdir(join(tmpDir, 'test-cluster/invalid-agent'), {recursive: true})

      await writeFile(join(tmpDir, 'test-cluster/valid-agent/SKILL.md'), `---
name: valid-test-agent
description: A valid agent
cluster: intelligence
---

# Valid Agent
`)
      await writeFile(join(tmpDir, 'test-cluster/invalid-agent/SKILL.md'), `---
description: Missing required name field
---

# Invalid Agent
`)

      await expect(loadAllSkills(tmpDir)).rejects.toThrow(SkillLoadError)
      await expect(loadAllSkills(tmpDir)).rejects.toMatchObject({
        code: 'SKILL_VALIDATION_FAILED',
      })
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
