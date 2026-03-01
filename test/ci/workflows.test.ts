import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import {describe, expect, it} from 'vitest'
import {parse as parseYaml} from 'yaml'

const WORKFLOWS_DIR = join(process.cwd(), '.github', 'workflows')

describe('CI workflow YAML', () => {
  it('ci.yml is valid YAML', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc).toBeDefined()
    expect(doc.name).toBe('CI')
  })

  it('ci.yml triggers on pull_request to main', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc.on.pull_request.branches).toContain('main')
  })

  it('ci.yml includes required steps in order', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    const steps = doc.jobs.ci.steps as Array<{name: string; run?: string}>
    const stepNames = steps.map((s) => s.name)

    expect(stepNames).toContain('Checkout')
    expect(stepNames).toContain('Install dependencies')
    expect(stepNames).toContain('TypeScript type check')
    expect(stepNames).toContain('Lint')
    expect(stepNames).toContain('Unit tests')
    expect(stepNames).toContain('Verify command manifest')

    // Verify order: type check before lint before tests
    const tscIdx = stepNames.indexOf('TypeScript type check')
    const lintIdx = stepNames.indexOf('Lint')
    const testIdx = stepNames.indexOf('Unit tests')
    expect(tscIdx).toBeLessThan(lintIdx)
    expect(lintIdx).toBeLessThan(testIdx)
  })

  it('ci.yml uses Node.js 18 matrix', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc.jobs.ci.strategy.matrix['node-version']).toContain(18)
  })

  it('ci.yml sets fail-fast: true', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc.jobs.ci.strategy['fail-fast']).toBe(true)
  })

  it('ci.yml caches node_modules', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    const cacheStep = (doc.jobs.ci.steps as Array<{uses?: string}>).find(
      (s) => s.uses?.startsWith('actions/cache@'),
    )
    expect(cacheStep).toBeDefined()
  })

  it('ci.yml uses actions/checkout@v4', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'ci.yml'), 'utf-8')
    const doc = parseYaml(content)
    const checkoutStep = (doc.jobs.ci.steps as Array<{uses?: string}>).find(
      (s) => s.uses?.startsWith('actions/checkout@'),
    )
    expect(checkoutStep?.uses).toBe('actions/checkout@v4')
  })
})

describe('Schema validation workflow YAML', () => {
  it('schema-validation.yml is valid YAML', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'schema-validation.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc).toBeDefined()
    expect(doc.name).toBe('Schema Validation')
  })

  it('schema-validation.yml triggers on SKILL.md and schema paths', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'schema-validation.yml'), 'utf-8')
    const doc = parseYaml(content)
    const paths = doc.on.pull_request.paths as string[]
    expect(paths).toContain('src/agents/**/SKILL.md')
    expect(paths).toContain('src/lib/schemas/**')
  })

  it('schema-validation.yml identifies SKILL.md files via git diff', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'schema-validation.yml'), 'utf-8')
    expect(content).toContain('git diff --name-only')
    expect(content).toContain('SKILL.md')
  })

  it('schema-validation.yml calls mat agents validate', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'schema-validation.yml'), 'utf-8')
    expect(content).toContain('mat agents validate')
  })

  it('schema-validation.yml uses GitHub Actions annotations', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'schema-validation.yml'), 'utf-8')
    expect(content).toContain('::error')
  })
})

describe('Release workflow YAML', () => {
  it('release.yml is valid YAML', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'release.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc).toBeDefined()
    expect(doc.name).toBe('Release')
  })

  it('release.yml triggers on v* tags', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'release.yml'), 'utf-8')
    const doc = parseYaml(content)
    expect(doc.on.push.tags).toContain('v*')
  })

  it('release.yml runs build, manifest, and publish steps', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'release.yml'), 'utf-8')
    const doc = parseYaml(content)
    const steps = doc.jobs.release.steps as Array<{name: string; run?: string}>
    const stepNames = steps.map((s) => s.name)

    expect(stepNames).toContain('Build')
    expect(stepNames).toContain('Generate command manifest')
    expect(stepNames).toContain('Publish to npm')
  })

  it('release.yml uses NPM_TOKEN secret', async () => {
    const content = await readFile(join(WORKFLOWS_DIR, 'release.yml'), 'utf-8')
    expect(content).toContain('NPM_TOKEN')
  })
})

describe('PR template', () => {
  it('PULL_REQUEST_TEMPLATE.md exists and has required sections', async () => {
    const content = await readFile(join(process.cwd(), '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf-8')
    expect(content).toContain('## What')
    expect(content).toContain('## Why')
    expect(content).toContain('## How')
    expect(content).toContain('## Testing')
    expect(content).toContain('## Checklist')
  })

  it('PR template checklist includes required items', async () => {
    const content = await readFile(join(process.cwd(), '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf-8')
    expect(content).toContain('tsc --noEmit')
    expect(content).toContain('vitest run')
    expect(content).toContain('SKILL.md schema validation')
    expect(content).toContain('Security review')
    expect(content).toContain('Documentation updated')
  })
})

describe('CONTRIBUTING.md', () => {
  it('exists and has required sections', async () => {
    const content = await readFile(join(process.cwd(), 'CONTRIBUTING.md'), 'utf-8')
    expect(content).toContain('Development Setup')
    expect(content).toContain('Code Standards')
    expect(content).toContain('Creating a New Agent')
    expect(content).toContain('Creating a Platform Module')
    expect(content).toContain('Trust Tiers')
  })

  it('links to agent-skill-schema.md', async () => {
    const content = await readFile(join(process.cwd(), 'CONTRIBUTING.md'), 'utf-8')
    expect(content).toContain('docs/agent-skill-schema.md')
  })

  it('links to platform-adapter-guide.md', async () => {
    const content = await readFile(join(process.cwd(), 'CONTRIBUTING.md'), 'utf-8')
    expect(content).toContain('docs/platform-adapter-guide.md')
  })

  it('explains builtin, verified, and community trust tiers', async () => {
    const content = await readFile(join(process.cwd(), 'CONTRIBUTING.md'), 'utf-8')
    expect(content).toContain('builtin')
    expect(content).toContain('verified')
    expect(content).toContain('community')
  })

  it('includes mat agents validate command', async () => {
    const content = await readFile(join(process.cwd(), 'CONTRIBUTING.md'), 'utf-8')
    expect(content).toContain('mat agents validate')
  })
})
