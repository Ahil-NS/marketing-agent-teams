# Contributing to marketing-agent-teams

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/<org>/marketing-agent-teams.git
cd marketing-agent-teams

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test          # or: npx vitest run

# Run in dev mode (uses tsx, no build step)
bin/dev <command>
```

**Requirements:** Node.js 18+, npm.

## Code Standards

| Rule | Details |
|---|---|
| Language | TypeScript strict mode, ESM only (no CommonJS) |
| File naming | `kebab-case` (e.g. `stage-runner.ts`) |
| Variables/functions | `camelCase` |
| Types/classes | `PascalCase` (no `I` prefix) |
| Constants | `SCREAMING_SNAKE_CASE` |
| Zod schemas | `camelCase` + `Schema` suffix (e.g. `agentDefinitionSchema`) |
| Imports | Use `.js` extension for relative paths; use `import type` for type-only imports |
| Errors | All errors extend `MATError` with `code`, `reason`, `resolution`, `source`, `severity` |
| Validation | Zod at all system boundaries — trust internal validated data |

**Import order** (enforced by ESLint):

```typescript
// 1. Node.js built-ins
import { readFile } from 'node:fs/promises'
// 2. External dependencies
import { Command, Flags } from '@oclif/core'
// 3. Internal modules
import { Orchestrator } from '../lib/orchestrator/index.js'
// 4. Relative imports
import { PipelineState } from './pipeline-state.js'
import type { OrchestratorConfig } from './types.js'
```

## Creating a New Agent

Agents are declarative SKILL.md files loaded at runtime. Follow these steps:

### 1. Choose a cluster

Agents live under `src/agents/<cluster>/<agent-name>/`. The clusters are:

| Cluster | Purpose |
|---|---|
| `intelligence` | Research, trends, competitor analysis |
| `strategy` | Campaign architecture, content calendars |
| `creation` | Content writing, derivative content |
| `optimization` | SEO, A/B testing, performance |
| `distribution` | Scheduling, cross-posting, publishing |
| `quality` | Brand voice checks, fact checking |
| `coordination` | Orchestration helpers |

### 2. Create the directory structure

```
src/agents/<cluster>/<agent-name>/
├── SKILL.md                  # Agent definition (YAML front matter + markdown body)
├── knowledge/                # Domain knowledge loaded as context
│   └── <topic>.md
└── templates/                # Output templates
    └── <output-name>.md
```

### 3. Write the SKILL.md

The SKILL.md file uses YAML front matter for structured metadata and a markdown body for the system prompt. See [docs/agent-skill-schema.md](docs/agent-skill-schema.md) for the full schema reference.

Key front matter fields:

```yaml
---
schemaVersion: '1.0.0'
agentName: my-agent
cluster: intelligence
trustTier: builtin
modelRequirement: sonnet
toolScopes: [WebSearch, WebFetch]
dataScopes: [brandVoice, competitorProfiles]
inputs:
  - name: topic
    type: string
    required: true
outputs:
  - name: report
    type: object
---
```

### 4. Validate

```bash
mat agents validate --path src/agents/<cluster>/<agent-name>
```

This runs:
- Zod schema validation on the YAML front matter
- Security lint via `validateSkillMdSafety()` (checks for 11 injection patterns)
- Reference checks on `toolScopes` and `dataScopes`

### 5. Submit a PR

Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) and ensure all checks pass.

## Creating a Platform Module

Platform modules connect the CLI to social/content platforms. See [docs/platform-adapter-guide.md](docs/platform-adapter-guide.md) for the full interface reference.

### 1. Implement the `PlatformAdapter` interface

```typescript
// src/lib/platforms/<platform-name>/<platform-name>-adapter.ts
import type { PlatformAdapter } from '../types.js'

export class MyPlatformAdapter implements PlatformAdapter {
  // Implement required methods: publish(), getMetrics(), validateCredentials()
}
```

### 2. Register in `AdapterRegistry`

Add the adapter to the platform adapter registry so the orchestrator can discover it.

### 3. Follow the directory pattern

```
src/lib/platforms/<platform-name>/
├── index.ts                    # Public exports
├── <platform-name>-adapter.ts  # Adapter implementation
├── types.ts                    # Platform-specific types
└── errors.ts                   # Platform-specific errors (extend MATError)
```

## Trust Tiers

Agents are assigned a trust tier that controls what they can access:

| Tier | Description | Restrictions |
|---|---|---|
| `builtin` | Ships with the CLI | Full tool and data access |
| `verified` | Reviewed and approved | Must declare all scopes; scopes enforced at runtime |
| `community` | Third-party contributions | Sandboxed — no file system write, no shell, restricted data scopes |

Community agents are validated by `validateSkillMdSafety()` which checks for:
- Shell/command injection patterns
- File system exfiltration attempts
- Credential access attempts
- Prompt injection markers
- And 7 more security patterns

## Testing

- **Test directory:** `test/` mirrors `src/` structure — never co-locate tests with source
- **Test files:** `kebab-case.test.ts`
- **Framework:** vitest v4.x
- **Fixtures:** `test/fixtures/`
- **Helpers:** `test/helpers/`

```bash
# Run all tests
npx vitest run

# Run tests in watch mode
npx vitest

# Run a specific test file
npx vitest run test/lib/agents/sandbox-validator.test.ts
```

### Test expectations

- Write failing tests first (red-green-refactor)
- Cover happy path, error cases, and edge cases
- Mock external APIs — never hit real services in tests
- All existing tests must continue to pass (zero regressions)

## Submitting a Pull Request

1. Create a feature branch from `main`
2. Make your changes following the code standards above
3. Run locally:
   ```bash
   npx tsc --noEmit    # Type check
   npx vitest run      # Tests
   ```
4. If you changed agents, also run:
   ```bash
   mat agents validate
   ```
5. Push and open a PR using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
6. CI will automatically run type checking, linting, tests, and (if applicable) schema validation

## Questions?

Open an issue or start a discussion in the repository.
