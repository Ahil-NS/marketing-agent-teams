# CLAUDE.md -- Project AI Context

## Project Purpose

Marketing Agent Teams (MAT) is an open-source AI marketing automation platform.
It orchestrates 30 specialized agents across 7 clusters through a 7-stage pipeline
to research, plan, create, optimize, review, and publish marketing content.
Users bring their own keys (BYOK) and run everything via CLI (`npx mat`).

## Tech Stack

- **Runtime:** Node 18+, ESM modules
- **Framework:** oclif (CLI), TypeScript strict mode
- **AI:** @anthropic-ai/claude-agent-sdk via `query()`
- **Validation:** Zod schemas throughout
- **Testing:** vitest with `disableConsoleIntercept: true`
- **Build:** tsup
- **Auth:** Claude Code login (no ANTHROPIC_API_KEY needed for AI calls)
- **Platform Auth:** OAuth2 tokens per platform (Reddit, TikTok, Facebook, Instagram)

## 7-Stage Pipeline

1. Intelligence -- trend research, audience analysis, competitor monitoring
2. Strategy -- content planning, campaign design, channel selection
3. Creation -- platform-specific content generation
4. Optimization -- SEO, A/B testing, timing, humanization
5. Quality -- brand compliance, fact-checking, sensitivity review
6. Distribution -- platform publishing
7. Coordination -- campaign orchestration, performance reporting

## 7 Agent Clusters (30 agents total)

- **Intelligence (6):** trend-scout, audience-researcher, competitor-analyst, viral-pattern-decoder, platform-algorithm, product-marketing-context
- **Strategy (3):** content-strategist, campaign-planner, channel-optimizer
- **Creation (6):** reddit-creator, tiktok-creator, facebook-creator, instagram-creator, hook-writer, content-atomizer
- **Optimization (5):** seo-optimizer, ab-test-designer, timing-optimizer, content-humanizer, hashtag-strategist
- **Quality (4):** brand-guardian, fact-checker, platform-compliance, sensitivity-reviewer
- **Distribution (4):** reddit-publisher, tiktok-publisher, facebook-publisher, instagram-publisher
- **Coordination (2):** pipeline-coordinator, campaign-coordinator, performance-analyst, report-generator

## SKILL.md Schema

Each agent is defined by a `SKILL.md` file in its directory under `src/agents/<cluster>/<agent-name>/`.
The file uses YAML front matter followed by a markdown body.

Required YAML front matter fields:

```yaml
---
name: agent-name
description: "What this agent does (must be >20 chars)"
cluster: intelligence | strategy | creation | optimization | quality | distribution | coordination
model: claude-sonnet-4-20250514
tools:
  - WebSearch
  - WebFetch
  - Read
trustTier: builtin | verified | community
---
```

The markdown body contains the system prompt: role definition, instructions,
output format, constraints, and examples.

## Trust Tiers

| Tier | Access | Use Case |
|------|--------|----------|
| `builtin` | Full filesystem, Bash, all SDK tools | First-party agents shipped with MAT |
| `verified` | Scoped filesystem (project dir only), WebSearch, WebFetch | Reviewed community agents |
| `community` | Sandboxed, no filesystem, no Bash, read-only web | Untrusted third-party agents |

## CLI Commands

| Command | Description |
|---------|-------------|
| `mat run` | Execute a pipeline run |
| `mat create` | Scaffold a new agent or vertical module |
| `mat dashboard` | Open the monitoring dashboard |
| `mat context` | Manage brand context and product info |
| `mat history` | View past pipeline runs |
| `mat review` | Review and approve content before publishing |
| `mat agents` | List, validate, and manage agents |
| `mat config` | Manage configuration and credentials |

## Key Directories

```
src/
  agents/               # Agent SKILL.md definitions organized by cluster
    intelligence/
    strategy/
    creation/
    optimization/
    quality/
    distribution/
    coordination/
  commands/              # oclif CLI commands
  lib/
    agents/              # Agent executor, skill loader, path resolver
    orchestrator/        # Pipeline orchestrator and stage runner
    tmux/                # Session management
    agent-testing/       # Agent test runner
```

## Coding Conventions

- **Files:** kebab-case (`skill-loader.ts`, `stage-runner.ts`)
- **Functions:** camelCase (`loadSkill()`, `resolveAgentDir()`)
- **Types/Interfaces:** PascalCase (`AgentResult`, `PipelineConfig`)
- **Error codes:** SCREAMING_SNAKE_CASE (`AGENT_NOT_FOUND`, `SKILL_PARSE_ERROR`)
- **Imports:** Always use `.js` extensions on relative imports (ESM requirement)

```typescript
// Correct
import { loadSkill } from './skill-loader.js';

// Wrong
import { loadSkill } from './skill-loader';
```

## Error Handling

IMPORTANT: All custom errors MUST extend the `MATError` base class.

```typescript
import { MATError } from '../errors.js';

export class AgentNotFoundError extends MATError {
  constructor(name: string) {
    super(`Agent not found: ${name}`, 'AGENT_NOT_FOUND');
  }
}
```

## Testing

- Framework: vitest
- Config must include `disableConsoleIntercept: true`
- Test files: `*.test.ts` colocated with source or in `__tests__/`
- Run: `npx vitest run`

## Key Implementation Details

- `skill-loader.ts` reads SKILL.md + knowledge/ + templates/ dirs, assembles systemPrompt for `query()`
- Stage runner calls `resolveAgentDir()` to find agent directories by name
- Pipeline logging uses NDJSON format (one JSON object per line)
- Platform publishing is handled by stage-runner calling adapters directly (not agent tools)
- Claude Code session nesting is not supported (CLAUDECODE env var blocks nested `query()` calls)

## Package Manager

Use npm (not yarn or pnpm). Lock file: `package-lock.json`.
