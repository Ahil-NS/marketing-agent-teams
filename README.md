# Marketing Agent Teams (MAT)

> **One developer plus a team of AI agents producing the marketing output of a 10-person team, for the cost of API calls alone.**

CLI-driven multi-agent AI system that automates the entire marketing lifecycle — trend research, content creation, optimization, quality review, and multi-platform publishing across Reddit, TikTok, Facebook, and Instagram. Using Claude Code authentication (zero API key setup), users pay only for AI usage (**~$5-50/month**) — a 90-95% cost reduction versus paid alternatives like HubSpot Breeze ($450/mo) or Salesforce Agentforce ($650/user/mo).

Built on 11 battle-tested [Champ](https://github.com/ahilahilendran/champ) marketing skills and self-dogfooded from day one — MAT markets Champ (a wellness app), providing transparent, metrics-backed proof of its own value.

---

## Overview

MAT orchestrates **30+ specialized AI agents** organized into **7 functional clusters** through a **7-stage pipeline**. Each agent is defined as a SKILL.md file (YAML front matter + markdown system prompt) and executed via `claude -p` (native mode) or the Claude Agent SDK through an `AgentExecutor` adapter interface.

**Key design decisions:**

- **Claude Code CLI authentication** — no API key management; users run `claude login` once
- **AgentExecutor adapter** — thin interface (`execute()`, `estimateCost()`) with `ClaudeAgentExecutor` as MVP; designed for future multi-provider support
- **SKILL.md agent definitions** — declarative, versionable, community-contributable
- **Optional tmux integration** — `mat run --tmux` for real-time pipeline visualization with per-stage panes
- **Zero telemetry** — fully local execution, no cloud services, no analytics, no phone-home
- **Crash recovery** — pipeline state persisted after every stage; `mat run --resume <run-id>` continues from the last checkpoint

---

## Why MAT?

The market has expensive AI marketing suites and free open-source schedulers with zero AI intelligence. Nobody occupies the **high-AI-intelligence, near-zero-cost** position:

| Tool | Monthly Cost | AI Intelligence | Full Pipeline |
|---|---|---|---|
| HubSpot Breeze | $450/mo | High | Partial |
| Salesforce Agentforce | $650/user/mo | High | Partial |
| Hootsuite | $199/mo | Low | Scheduling only |
| CrewAI (44K ⭐) | Free | Framework only | Zero marketing agents |
| LangChain (80K ⭐) | Free | Framework only | Zero marketing agents |
| **MAT** | **$5-50/mo** | **High (30+ agents)** | **Research → Publish** |

No open-source project has claimed multi-agent marketing automation. First-mover window: **6-12 months**.

---

## Pipeline Stages

```
mat run --platforms reddit,tiktok
  │
  ├─→ Hook: init.ts (load .mat/config.yaml, validate project)
  ├─→ Hook: prerun.ts (verify Claude Code auth, check budget, inject platform OAuth tokens)
  │
  ├─→ Orchestrator.execute(config)
  │     │
  │     ├─→ Stage: research
  │     │     └─→ trend-scout, audience-researcher, competitor-analyst
  │     │
  │     ├─→ Stage: strategy
  │     │     └─→ content-strategist, campaign-planner, channel-optimizer
  │     │
  │     ├─→ Stage: creation (parallel via subagents)
  │     │     └─→ reddit-creator, tiktok-creator, facebook-creator,
  │     │         instagram-creator, hook-writer
  │     │
  │     ├─→ Stage: optimization
  │     │     └─→ seo-optimizer, ab-test-designer, timing-optimizer, hashtag-strategist
  │     │
  │     ├─→ Stage: quality
  │     │     └─→ brand-guardian, fact-checker, platform-compliance, sensitivity-reviewer
  │     │
  │     ├─→ Stage: review (PIPELINE PAUSES)
  │     │     └─→ ReviewQueue.enqueue(contentItems)
  │     │         User runs: mat review list → mat review approve <id>
  │     │
  │     └─→ Stage: distribution (after review)
  │           └─→ PlatformAdapter.publish(approvedItems)
  │
  └─→ Pipeline state persisted to .mat/state/pipeline-runs/<run-id>.json
```

The **review stage pauses** the pipeline for human approval — nothing publishes without explicit consent. Use `mat run --dry-run` to generate content without publishing. Use `mat run --resume <run-id>` to recover a crashed pipeline from the last completed stage.

---

## Agent Clusters (MVP)

| Cluster | Count | Agents | Pipeline Stage |
|---|---|---|---|
| **Intelligence** | 6 | trend-scout, audience-researcher, competitor-analyst, viral-pattern-decoder, platform-algorithm, product-marketing-context | research |
| **Strategy** | 3 | content-strategist, campaign-planner, channel-optimizer | strategy |
| **Creation** | 6 | reddit-creator, tiktok-creator, facebook-creator, instagram-creator, hook-writer, content-atomizer | creation |
| **Optimization** | 5 | seo-optimizer, ab-test-designer, timing-optimizer, content-humanizer, hashtag-strategist | optimization |
| **Quality** | 4 | brand-guardian, fact-checker, platform-compliance, sensitivity-reviewer | quality |
| **Distribution** | 4 | reddit-publisher, tiktok-publisher, facebook-publisher, instagram-publisher | distribution |
| **Coordination** | 4 | campaign-coordinator, performance-analyst, report-generator, pipeline-coordinator | cross-stage |

> **32 agents total** across 7 clusters and 7 pipeline stages.

---

## Technical Architecture

### 4-Layer Component Boundary

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Layer (src/commands/)                                   │
│  oclif commands → parse flags/args → call lib → format output│
├─────────────────────────────────────────────────────────────┤
│  Orchestration Layer (src/lib/orchestrator/)                  │
│  Pipeline state machine → stage sequencing → agent dispatch  │
├──────────────────────┬──────────────────────────────────────┤
│  Agents Module        │  Review Queue                        │
│  (src/lib/agents/)    │  (src/lib/review-queue/)             │
├──────────────────────┴──────────────────────────────────────┤
│  Infrastructure Layer                                        │
│  ┌───────────┐ ┌───────────┐ ┌──────────────┐              │
│  │ Platforms  │ │Credentials│ │ State/Schemas│              │
│  └───────────┘ └───────────┘ └──────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Directory | Responsibility |
|---|---|---|
| **CLI** | `src/commands/` | Thin delegates — parse flags/args, call library functions, format output |
| **Orchestration** | `src/lib/orchestrator/` | Pipeline state machine, stage sequencing, budget tracking, tmux routing |
| **Domain** | `src/lib/agents/`, `src/lib/review-queue/` | AgentExecutor adapter, SKILL.md loader, content models, review queue logic |
| **Infrastructure** | `src/lib/platforms/`, `src/lib/credentials/`, `src/lib/state/` | Platform adapters, credential manager, file I/O, structured logging |

See [architecture.md](_bmad-output/planning-artifacts/architecture.md) for full details including data boundaries, integration boundaries, and requirements-to-structure mapping.

### Pipeline State Machine

```typescript
interface PipelineRun {
  id: string
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  currentStage: PipelineStage
  stageResults: Record<PipelineStage, StageResult>
  contentItems: ContentItem[]
  budget: { spent: number; limit: number; currency: 'USD' }
  config: { platforms: string[]; dryRun: boolean }
  startedAt: string
  updatedAt: string
  errors: PipelineError[]
}
```

**State transitions:**

```
research → strategy → creation → optimization → quality → review (PAUSE) → distribution
Any stage can → failed (with retry capability)
Any stage can → paused (manual pause)
failed → retry → resume from failed stage
```

State is persisted to `.mat/state/pipeline-runs/<run-id>.json` after every stage transition. On crash, `mat run --resume <run-id>` loads state and continues from `currentStage`.

---

## AgentExecutor Adapter Interface

The `AgentExecutor` interface is a thin adapter that decouples agent execution from any specific AI provider. The MVP ships with `ClaudeAgentExecutor`; future providers implement the same contract.

```typescript
interface AgentExecutor {
  execute(options: {
    skillMd: string           // Parsed SKILL.md content (system prompt)
    input: AgentInput         // Typed input from upstream stage
    model?: string            // Model override (default from SKILL.md front matter)
    allowedTools?: string[]   // Tool permissions from SKILL.md
    budget?: BudgetConstraint // Per-agent budget limit
  }): AsyncIterable<AgentMessage>

  estimateCost(model: string, inputTokens: number): number
}
```

**Module location:** `src/lib/agent-executor/`

| File | Purpose |
|---|---|
| `index.ts` | `AgentExecutor` interface export |
| `claude-agent-executor.ts` | MVP implementation wrapping Claude Agent SDK `query()` |
| `types.ts` | `AgentInput`, `AgentMessage`, `BudgetConstraint` types |

**Evolution:** Wave 2 adds `openai-agent-executor.ts`, Wave 3 adds `google-agent-executor.ts`, with `executor-registry.ts` mapping provider names to implementations. Agent SKILL.md front matter can optionally declare a preferred provider; default is Claude.

---

## SKILL.md Agent Definitions

Every agent is defined by a `SKILL.md` file using YAML front matter (configuration) + markdown body (system prompt):

```markdown
---
name: trend-scout
description: Researches current trends, viral patterns, and content opportunities
cluster: intelligence
stage: research
model: sonnet
tools:
  - WebSearch
  - WebFetch
permissions:
  credentials: []
inputs:
  - brandContext
  - targetAudience
outputs:
  - trendBrief
---

You are a trend research specialist. Analyze current trends...
(system prompt continues in markdown)
```

Each agent directory follows this structure:

```
src/agents/<cluster>/<agent-name>/
  SKILL.md         # Agent definition (YAML front matter + markdown body)
  knowledge/       # Domain expertise files (research frameworks, data, etc.)
  templates/       # Output format templates (trend briefs, content outlines, etc.)
```

The `skill-loader.ts` module reads SKILL.md files at runtime, validates front matter via Zod schemas, and loads companion `knowledge/` and `templates/` files. See `docs/skill-md-schema.md` for the full schema specification.

---

## Security Model

### Trust Tiers

Agents are classified into trust tiers that control what credentials they can access:

| Tier | OAuth Tokens | Filesystem | Network | Source |
|---|---|---|---|---|
| **Builtin** | Full access (scoped to declared permissions) | Read/Write within `.mat/` | WebSearch, WebFetch | Ships with MAT |
| **Verified** | Full access (scoped to declared permissions) | Read/Write within `.mat/` | WebSearch, WebFetch | Community-reviewed |
| **Community** | **None** — no OAuth tokens injected | Read only | WebSearch only | Unreviewed |

### Credential Isolation

- **Claude Code auth** — automatic via Agent SDK; no API key setup needed
- **Platform OAuth tokens** (Reddit, TikTok, Facebook, Instagram) — stored in OS keychain via `@aspect-build/keytar`; **never** written to disk
- Token metadata (which platforms connected, expiry dates) stored in `.mat/credentials/platforms.json`
- Tokens injected **only** for agents whose SKILL.md `permissions.credentials` block declares matching platforms
- Community agents at "Unreviewed" tier receive **no OAuth tokens**

### SKILL.md Sandboxing

Agent SDK `allowedTools` limits what tools each agent can use. Tools are scoped per SKILL.md front matter `tools:` declaration:

- Available tools: `WebSearch`, `WebFetch`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `Task`
- Agents can only use tools explicitly declared in their SKILL.md
- The `CredentialManager` validates agent permissions against trust tiers before injecting credentials

### Zero Telemetry

MAT runs **entirely locally** — no cloud services, no analytics, no phone-home, no data collection (NFR8). All state, content, credentials, and logs remain on the user's machine in the `.mat/` directory.

---

## tmux Integration

Optional real-time pipeline visualization with per-stage panes, detachable sessions, and automatic log capture.

```
mat run --tmux
    │
    ├── TmuxSessionManager.create("mat-<run-id>")
    │       ├── Create tmux session with 6 panes (one per pipeline stage)
    │       ├── Configure pipe-pane for each pane → .mat/logs/<run-id>/
    │       └── Set status bar: progress | budget | content count | elapsed
    │
    ├── Pipeline stages route output to assigned panes
    │       ├── Pane 1: Intelligence & Research
    │       ├── Pane 2: Strategy & Planning
    │       ├── Pane 3: Content Creation
    │       ├── Pane 4: Optimization
    │       ├── Pane 5: Quality & Review
    │       └── Pane 6: Distribution
    │
    └── User can: Ctrl-b d (detach) → mat attach (reattach)
```

- **Not a hard dependency** — if tmux is not installed, falls back to standard terminal output
- **Status bar** shows pipeline progress, budget spent, content count, and elapsed time
- **Automatic log capture** via `pipe-pane` writes per-stage logs to `.mat/logs/<run-id>/`
- **`--auto-close` flag** for CI/automated environments — destroys session on completion

**Module location:** `src/lib/tmux/` — `session-manager.ts`, `pane-layout.ts`, `status-bar.ts`, `logger.ts`

---

## Technical Stack

| Component | Technology | Notes |
|---|---|---|
| CLI Framework | oclif v4.8.1 | TypeScript-first, plugin architecture |
| AI Provider (MVP) | Claude Agent SDK 0.2.63 (exact) | Via Claude Code CLI auth |
| Agent Definitions | SKILL.md | YAML front matter + markdown prompt |
| Credential Storage | @aspect-build/keytar | Platform OAuth tokens in OS keychain |
| Config/State | YAML + JSON in `.mat/` | Human-readable, Git-diffable |
| Validation | Zod v4.3.6 | Schema validation for config, agents, outputs |
| Build | tsup 8.5.1 | ESM output |
| Testing | vitest 4.0.18 | `disableConsoleIntercept: true` required |
| Runtime | Node.js 18+ LTS | ESM only, strict TypeScript |
| Pipeline Visualization | tmux (optional) | 6-pane layout, status bar, log capture |

---

## Getting Started

```bash
# Install MAT globally
npm install -g marketing-agent-teams

# Authenticate with Claude (one-time)
claude login

# Initialize a new project
mat install

# Connect social platforms
mat config platforms add reddit
mat config platforms add tiktok

# Run the full pipeline
mat run

# Run with tmux visualization
mat run --tmux

# Reattach to a running pipeline
mat attach
```

### Install Wizard Flow

```
mat install
  ├─→ Step 1: Project Initialization (scaffold .mat/ directory)
  ├─→ Step 2: Voice & Brand Configuration (interactive prompts)
  ├─→ Step 3: Platform OAuth Setup (per-platform OAuth2 flows)
  └─→ Step 4: Agent Configuration (select agents, budgets)

  Note: No API key step — Claude Code authentication is automatic.
```

---

## CLI Commands

| Command | Purpose |
|---|---|
| `mat install` | Interactive setup wizard — scaffolds `.mat/` project directory |
| `mat run` | Execute the full marketing pipeline |
| `mat run --tmux` | Execute with tmux real-time visualization |
| `mat run --dry-run` | Generate content without publishing |
| `mat run --resume <id>` | Resume a crashed/paused pipeline from last checkpoint |
| `mat attach` | Reattach to a running tmux pipeline session |
| `mat review` | Open the content review queue |
| `mat review approve <id>` | Approve a content item for publishing |
| `mat config` | Manage brand voice, platforms, agents, budgets |
| `mat config platforms add` | Connect a social platform via OAuth |
| `mat config agents` | Enable/disable/configure individual agents |
| `mat create --brief <file>` | Create content from a brief (skip research/strategy) |
| `mat create --idea <topic>` | Create content from an idea (targeted research) |
| `mat create --agent <name>` | Run a single agent in isolation |
| `mat context --init` | Run product marketing context discovery |
| `mat context --show` | Display current brand context |
| `mat dashboard` | Start the localhost web dashboard |
| `mat history` | View campaign history and content records |
| `mat agents` | List, add, remove, trust community agents |
| `mat agents add <pkg>` | Install a community agent via oclif plugin |
| `mat status` | Show pipeline run history and current state |
| `mat logs <run-id>` | View pipeline logs for a specific run |

---

## Sample Output

See the `demo/` directory for example outputs:

| File | Description |
|---|---|
| `demo/pipeline-run.log` | NDJSON log from a full pipeline run |
| `demo/intelligence-stage-output.json` | Research stage agent results |
| `demo/report-generator-output.md` | Campaign performance report |
| `demo/reddit-post-example.md` | Reddit post with hooks and CTA |

---

## Web Dashboard

Start the visual dashboard with `mat dashboard`:

```bash
mat dashboard              # Opens http://localhost:3847
mat dashboard --port 8080  # Custom port
```

The dashboard provides:
- **Pipeline View** — Real-time 7-stage pipeline visualization with SSE updates
- **Review View** — Content cards with platform-specific previews, approve/reject/edit
- **History View** — Campaign history table with content drill-down
- **Context View** — Brand context viewer and inline editor

---

## Data Architecture

### `.mat/` Project Directory

```
.mat/
  config.yaml                    # Project config (brand voice, platforms, API model)
  state/
    pipeline-runs/               # Run history — one JSON file per run
      <run-id>.json
    review-queue/                # Current review items — one JSON file per content item
      <item-id>.json
    retry-queue/                 # Failed publish attempts — persistent, zero data loss
      <item-id>.json
  agents/
    <agent-name>/
      state.json                 # Per-agent persistent memory (FR60-62)
  content/
    <run-id>/                    # Generated content per pipeline run
      <agent>-<item-id>.json
  credentials/                   # Token metadata only — actual secrets in OS keychain
    platforms.json               # Which platforms connected, token expiry dates
  logs/                          # Pipeline diagnostics + tmux pipe-pane output
    <run-id>/
      pipeline.log               # Aggregate pipeline log
      intelligence.log           # Per-stage tmux pane logs
      strategy.log
      creation.log
      optimization.log
      quality.log
      distribution.log
```

All state files use JSON with `camelCase` field names. Date/time fields use ISO 8601 strings. Config uses YAML for human readability.

**Evolution path:** If Growth-phase features (web UI, multi-client, complex review filtering) need structured queries, internal storage migrates to SQLite via `better-sqlite3`. The `.mat/` directory structure stays unchanged.

### Inter-Agent Communication

Agents never communicate directly. All data flows through pipeline state:

```
Agent A (output) → Pipeline State → Agent B (input)
```

The orchestrator resolves input dependencies before each agent execution from upstream stage outputs.

---

## Source Directory Structure

```
marketing-agent-teams/
  bin/
    mat                          # CLI entry point
    dev                          # Development mode (uncompiled, via tsx)
  src/
    commands/                    # oclif command definitions
      install.ts
      run.ts
      status.ts
      review/                   # Review subcommands (list, approve, reject)
      config/                   # Config subcommands (platforms, agents, voice)
      agents/                   # Agent management (list, add, test)
    lib/
      orchestrator/              # Pipeline state machine, stage sequencing, budget tracking
      agents/                   # Agent execution, skill-loader.ts
      agent-executor/           # AgentExecutor interface + ClaudeAgentExecutor
      platforms/                # Platform adapters (reddit/, tiktok/, facebook/, instagram/)
      credentials/              # Credential manager, trust-tiers.ts
      review-queue/             # Review queue logic
      schemas/                  # Zod schemas for config, agents, content
      state/                    # State manager (pipeline runs, retry queue)
      tmux/                     # Session manager, pane layout, status bar, logger
      logger/                   # NDJSON structured logger
      utils/                    # retry.ts, errors.ts (MATError), ids.ts
    hooks/                      # oclif lifecycle hooks (init.ts, prerun.ts)
    agents/                     # SKILL.md definitions organized by cluster
      intelligence/             # trend-scout/, audience-researcher/, competitor-analyst/
      strategy/                 # content-strategist/, campaign-planner/, channel-optimizer/
      creation/                 # reddit-creator/, tiktok-creator/, ... , hook-writer/
      optimization/             # seo-optimizer/, ab-test-designer/, timing-optimizer/, hashtag-strategist/
      quality/                  # brand-guardian/, fact-checker/, platform-compliance/, sensitivity-reviewer/
      distribution/             # reddit-publisher/, tiktok-publisher/, facebook-publisher/, instagram-publisher/
      coordination/             # campaign-coordinator/, performance-analyst/, report-generator/
    templates/                  # Project scaffolding templates for mat install
  test/
  docs/
```

---

## OAuth Flow

### Browser-Based (Default)

```
1. User runs: mat config platforms add reddit
2. CLI opens browser to Reddit OAuth consent page
3. Tiny local HTTP server starts on localhost:PORT/callback
4. User authorizes → Reddit redirects to localhost callback
5. CLI captures authorization code → exchanges for access/refresh tokens
6. Tokens stored in OS keychain via @aspect-build/keytar
7. Token metadata stored in .mat/credentials/platforms.json
8. CLI confirms: "Reddit connected. Token expires in 60 days."
```

### Manual Fallback (Headless/SSH)

For environments without a browser, users can paste tokens directly via `mat config platforms add --manual`.

### Token Lifecycle

- Expiry dates tracked in `.mat/credentials/platforms.json`
- **Proactive refresh:** attempt when token is within 7 days of expiry
- **Instagram:** 60-day tokens get a 14-day advance warning
- **On expiry:** attempt automatic refresh via refresh token; on failure, prompt re-auth with clear message

---

## Error Handling

All errors extend a base `MATError` class with consistent, actionable structure:

```typescript
class MATError extends Error {
  constructor(
    message: string,
    public readonly code: string,           // e.g., 'PIPELINE_BUDGET_EXCEEDED'
    public readonly reason: string,         // Human-readable cause
    public readonly resolution: string,     // Actionable fix
    public readonly source: string,         // Component that threw
    public readonly severity: 'transient' | 'permanent',
  )
}
```

**Error code convention:** `SCREAMING_SNAKE_CASE` with component prefix — `PIPELINE_*`, `PLATFORM_*`, `AGENT_*`, `CREDENTIAL_*`, `PROVIDER_*`.

**Retry policy:** All external API calls wrapped with `withRetry`:
- AI calls: 3 attempts, 1000ms base, exponential backoff
- Platform API calls: 5 attempts, 2000ms base, exponential backoff
- Transient errors retry automatically; permanent errors surface immediately

**Zero data loss:** Failed publish attempts persist in `.mat/state/retry-queue/` and retry on next pipeline run.

---

## Community & Extensibility

### Adding Community Agents

Community agents are installed as oclif plugins:

```bash
mat agents add @community/linkedin-agent    # Install community agent
mat agents list                              # See all agents (builtin + community)
mat agents trust @community/linkedin-agent   # Elevate trust tier
```

### What's Extensible

| Extension Point | Contract | Documentation |
|---|---|---|
| **Agents** | SKILL.md schema (YAML front matter + markdown) | `docs/skill-md-schema.md` |
| **Platform modules** | `PlatformAdapter` interface | `docs/platform-adapter-guide.md` |
| **Vertical templates** | Industry-specific content libraries | `docs/vertical-modules.md` |

### Contribution Path

1. Create a SKILL.md + `knowledge/` + `templates/` directory following the same structure as built-in agents
2. Publish as an npm package with oclif plugin manifest
3. CI validation: GitHub Actions validates SKILL.md schemas on PR via `schema-validation.yml`
4. Schema versioning follows semver for stable public contracts (NFR22)

---

## Development Workflow

```bash
bin/dev run --dry-run            # Run uncompiled TypeScript directly via tsx
bin/dev agents test <name>       # Test agent in isolation without build step
npm test                         # vitest (requires disableConsoleIntercept: true)
npm run build                    # tsup → ESM output
```

### CI/CD

| Workflow | Trigger | Steps |
|---|---|---|
| **ci.yml** | PR to main | `npm ci` → `tsc --noEmit` → `eslint` → `vitest run` → `oclif manifest` |
| **release.yml** | Git tag `v*` | `npm ci` → `tsup build` → `oclif manifest` → `npm publish` |
| **schema-validation.yml** | PR | Validates all SKILL.md front matter schemas |

### Naming Conventions

| Scope | Convention | Example |
|---|---|---|
| Files/directories | kebab-case | `trend-scout/`, `skill-loader.ts` |
| Types/interfaces/classes | PascalCase | `PipelineRun`, `AgentExecutor`, `MATError` |
| Functions/variables | camelCase | `resolveInputs()`, `budgetTracker` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `DEFAULT_MODEL` |
| Error codes | SCREAMING_SNAKE_CASE with prefix | `PIPELINE_BUDGET_EXCEEDED` |
| Hook events | kebab-case with prefix | `pipeline:stage-start`, `agent:execution-complete` |

---

## Roadmap

| Phase | Agents | Platforms | Key Features |
|---|---|---|---|
| **Sprint 1 (MVP)** | 23 | Reddit, TikTok, Facebook, Instagram | Core pipeline, CLI, tmux, review queue, SKILL.md agents |
| **Wave 2** | 26 | + YouTube, X/Twitter | AgentExecutor multi-provider (OpenAI), coordination agents, scheduled runs |
| **Wave 3** | 30+ | + Pinterest, LinkedIn (community) | Community marketplace, web review UI, multi-client management |
| **Wave 4** | 40+ | Community-contributed | Analytics dashboard, A/B test automation, real-time optimization |

**North star metric:** Active marketing pipelines running weekly.
**Targets:** 20 pipelines (3mo) → 100 (6mo) → 500+ (12mo). 100 GitHub stars (3mo) → 2,000+ (12mo).

---

## License

MIT
