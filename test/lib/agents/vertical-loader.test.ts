import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {describe, it, expect, beforeEach, afterEach} from 'vitest'

import {loadVertical, getVerticalContext} from '../../../src/lib/agents/vertical-loader.js'
import {SkillLoadError} from '../../../src/lib/agents/errors.js'
import type {VerticalDefinition} from '../../../src/lib/agents/vertical-loader.js'

describe('loadVertical', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vertical-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, {recursive: true, force: true})
  })

  it('reads wellness vertical manifest', async () => {
    const verticalDir = join(tempDir, 'wellness')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `name: wellness
description: Wellness vertical module
version: 1.0.0
complianceRules:
  - No medical claims
knowledgeFiles:
  - knowledge/wellness-hooks.md
`,
    )
    await writeFile(
      join(verticalDir, 'knowledge', 'wellness-hooks.md'),
      '# Wellness Hooks\n\nHook content here.',
    )

    const result = await loadVertical('wellness', tempDir)
    expect(result.name).toBe('wellness')
    expect(result.description).toBe('Wellness vertical module')
    expect(result.version).toBe('1.0.0')
    expect(result.complianceRules).toEqual(['No medical claims'])
  })

  it('loads all knowledge files from vertical directory', async () => {
    const verticalDir = join(tempDir, 'wellness')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `name: wellness
description: Wellness vertical
version: 1.0.0
complianceRules: []
knowledgeFiles:
  - knowledge/a.md
  - knowledge/b.md
`,
    )
    await writeFile(join(verticalDir, 'knowledge', 'a.md'), '# File A\n\nContent A.')
    await writeFile(join(verticalDir, 'knowledge', 'b.md'), '# File B\n\nContent B.')

    const result = await loadVertical('wellness', tempDir)
    expect(result.knowledgeFiles).toEqual(['knowledge/a.md', 'knowledge/b.md'])
    expect(result.knowledgeContext).toContain('# File A')
    expect(result.knowledgeContext).toContain('# File B')
  })

  it('returns concatenated markdown from getVerticalContext', async () => {
    const verticalDir = join(tempDir, 'wellness')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `name: wellness
description: Wellness vertical
version: 1.0.0
complianceRules: []
knowledgeFiles:
  - knowledge/hooks.md
`,
    )
    await writeFile(join(verticalDir, 'knowledge', 'hooks.md'), '# Hooks\n\nHook patterns here.')

    const context = await getVerticalContext('wellness', tempDir)
    expect(context).toContain('# Hooks')
    expect(context).toContain('Hook patterns here.')
  })

  it('throws when vertical directory does not exist', async () => {
    await expect(loadVertical('nonexistent', tempDir)).rejects.toThrow(SkillLoadError)
    try {
      await loadVertical('nonexistent', tempDir)
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('VERTICAL_NOT_FOUND')
    }
  })

  it('validates against verticalDefinitionSchema', async () => {
    const verticalDir = join(tempDir, 'bad-vertical')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    // Missing required fields: name, description, version
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `complianceRules: []
`,
    )

    await expect(loadVertical('bad-vertical', tempDir)).rejects.toThrow(SkillLoadError)
    try {
      await loadVertical('bad-vertical', tempDir)
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('VERTICAL_VALIDATION_FAILED')
    }
  })

  it('throws on malformed YAML syntax', async () => {
    const verticalDir = join(tempDir, 'bad-yaml')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      'name: bad: yaml: : :\n  broken:\n- mixed: indentation\n',
    )

    await expect(loadVertical('bad-yaml', tempDir)).rejects.toThrow(SkillLoadError)
    try {
      await loadVertical('bad-yaml', tempDir)
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('VERTICAL_VALIDATION_FAILED')
    }
  })

  it('rejects path traversal in vertical name', async () => {
    await expect(loadVertical('../etc', tempDir)).rejects.toThrow(SkillLoadError)
    try {
      await loadVertical('../etc', tempDir)
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('VERTICAL_INVALID_NAME')
    }
  })

  it('rejects invalid vertical names', async () => {
    for (const name of ['../etc', 'UPPER', 'has spaces', 'has.dot', '']) {
      await expect(loadVertical(name, tempDir)).rejects.toThrow(SkillLoadError)
    }
  })

  it('loads only files listed in knowledgeFiles when specified', async () => {
    const verticalDir = join(tempDir, 'selective')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `name: selective
description: Selective loading test
version: 1.0.0
complianceRules: []
knowledgeFiles:
  - knowledge/included.md
`,
    )
    await writeFile(join(verticalDir, 'knowledge', 'included.md'), '# Included\n\nThis should be loaded.')
    await writeFile(join(verticalDir, 'knowledge', 'excluded.md'), '# Excluded\n\nThis should NOT be loaded.')

    const result = await loadVertical('selective', tempDir)
    expect(result.knowledgeContext).toContain('# Included')
    expect(result.knowledgeContext).not.toContain('# Excluded')
  })

  it('throws when a knowledgeFiles entry is missing from disk', async () => {
    const verticalDir = join(tempDir, 'missing-file')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `name: missing-file
description: Missing knowledge file test
version: 1.0.0
complianceRules: []
knowledgeFiles:
  - knowledge/does-not-exist.md
`,
    )

    await expect(loadVertical('missing-file', tempDir)).rejects.toThrow(SkillLoadError)
    try {
      await loadVertical('missing-file', tempDir)
    } catch (error) {
      expect(error).toBeInstanceOf(SkillLoadError)
      expect((error as SkillLoadError).code).toBe('VERTICAL_KNOWLEDGE_FILE_MISSING')
    }
  })
})

describe('vertical integration with skill-loader', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vertical-skill-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, {recursive: true, force: true})
  })

  it('getVerticalContext returns empty string when vertical does not exist', async () => {
    const context = await getVerticalContext('nonexistent', tempDir)
    expect(context).toBe('')
  })

  it('vertical knowledge appears as concatenated markdown context', async () => {
    const verticalDir = join(tempDir, 'wellness')
    await mkdir(join(verticalDir, 'knowledge'), {recursive: true})
    await writeFile(
      join(verticalDir, 'vertical.yaml'),
      `name: wellness
description: Wellness vertical
version: 1.0.0
complianceRules:
  - No medical claims
  - Use approved language
knowledgeFiles:
  - knowledge/compliance.md
  - knowledge/templates.md
`,
    )
    await writeFile(join(verticalDir, 'knowledge', 'compliance.md'), '# Compliance\n\nNo medical claims.')
    await writeFile(join(verticalDir, 'knowledge', 'templates.md'), '# Templates\n\nContent templates.')

    const result = await loadVertical('wellness', tempDir)
    expect(result.knowledgeContext).toContain('# Compliance')
    expect(result.knowledgeContext).toContain('# Templates')
    // Knowledge files are sorted alphabetically and joined with separator
    const complianceIndex = result.knowledgeContext.indexOf('# Compliance')
    const templatesIndex = result.knowledgeContext.indexOf('# Templates')
    expect(complianceIndex).toBeLessThan(templatesIndex)
  })
})
