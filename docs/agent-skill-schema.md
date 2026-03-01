# Agent SKILL.md Schema Documentation

> **Schema Version:** 1.0.0
>
> **Canonical Source:** `src/lib/schemas/agent-schema.ts` → `agentDefinitionSchema`
>
> This document describes the SKILL.md file format used to define MAT agents.
> If this documentation and the Zod schema diverge, **the schema wins**.

---

## Overview

Every MAT agent is defined by a `SKILL.md` file located at:

```
src/agents/<cluster>/<agent-name>/SKILL.md
```

A SKILL.md file consists of two parts:

1. **YAML front matter** — structured metadata validated against `agentDefinitionSchema`
2. **Markdown body** — the agent's system prompt (free-form markdown)

Optional supporting directories sit alongside the SKILL.md:

```
src/agents/<cluster>/<agent-name>/
├── SKILL.md            # Required — agent definition
├── knowledge/          # Optional — .md files loaded as additional context
│   ├── domain-guide.md
│   └── platform-rules.md
└── templates/          # Optional — .md output templates
    └── report.md
```

---

## YAML Front Matter Fields

The front matter block is delimited by `---` lines at the top of the file.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | **Yes** | — | Kebab-case agent identifier. Must match the directory name. |
| `description` | `string` | **Yes** | — | One-line (or multi-line YAML `>`) description of the agent's purpose. |
| `cluster` | `enum` | **Yes** | — | One of: `intelligence`, `strategy`, `creation`, `optimization`, `quality`, `distribution`, `coordination` |
| `model` | `enum` | No | `haiku` | AI model tier: `haiku` (fast/cheap) or `sonnet` (creative/complex). |
| `tools` | `string[]` | No | `[]` | SDK tools the agent is allowed to use. Must be from the valid tools list (see below). |
| `trustTier` | `enum` | No | `builtin` | Trust level: `builtin`, `verified`, or `community`. Controls credential access and tool permissions. |
| `schemaVersion` | `string` | No | `1.0.0` | Semantic version of the SKILL.md schema this file conforms to. Format: `MAJOR.MINOR.PATCH`. |
| `permissions` | `object` | No | `{}` | Structured permissions block (see below). Defaults to deny-all if omitted. |
| `examples` | `array` | No | — | Example inputs for isolated agent testing via `mat agents test`. |

### Valid SDK Tools

The `tools` array and `permissions.toolScopes` accept only these values:

| Tool | Description |
|---|---|
| `WebSearch` | Search the web |
| `WebFetch` | Fetch web page content |
| `Read` | Read files from disk |
| `Write` | Write files to disk |
| `Edit` | Edit existing files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by glob pattern |
| `Grep` | Search file contents |
| `Task` | Create sub-agent tasks |

---

## Permissions Block

The `permissions` block controls what an agent can access at runtime. If omitted, the agent gets deny-all defaults (no credentials, no data scopes, no tool scopes).

```yaml
permissions:
  credentials:
    - reddit-oauth
  dataScopes:
    - pipeline-state
    - brand-config
  toolScopes:
    - WebSearch
    - Read
```

### Permissions Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `credentials` | `string[]` | `[]` | Platform OAuth keys the agent needs (e.g., `reddit-oauth`, `tiktok-oauth`). |
| `dataScopes` | `enum[]` | `[]` | Data stores the agent can access. |
| `toolScopes` | `enum[]` | `[]` | Must be a **subset** of the `tools` array. Declares which tools require permission enforcement. |

### Valid Data Scopes

| Scope | Description |
|---|---|
| `pipeline-state` | Read/write pipeline execution state |
| `brand-config` | Read brand voice and configuration |
| `agent-memory` | Read/write agent memory store |
| `content-items` | Read/write content items |
| `review-queue` | Read/write human review queue |
| `platform-metrics` | Read platform analytics data |

### Constraint

`permissions.toolScopes` must be a subset of `tools`. The schema enforces this with a refinement — if a tool scope is listed that isn't in the `tools` array, validation fails.

---

## Trust Tier Restrictions

The `trustTier` field determines what an agent is allowed to do. The `PermissionEnforcer` validates these boundaries at runtime.

| Tier | Allowed Tools | Credential Access | Use Case |
|---|---|---|---|
| `builtin` | All 9 SDK tools | Full access to all credentials | First-party agents shipped with MAT |
| `verified` | All except `Bash` (8 tools) | Declared credentials only | Reviewed third-party agents |
| `community` | Read-only: `WebSearch`, `WebFetch`, `Read`, `Glob`, `Grep` | **No credentials** | Untrusted community agents |

---

## Markdown Body (System Prompt)

Everything after the closing `---` delimiter is the agent's system prompt. It supports standard markdown formatting and is passed directly to the AI model.

Best practices:

- Start with a heading like `# Agent Name`
- Describe the agent's role, expertise, and process
- Include output format specifications (usually structured JSON)
- Define quality standards the agent must meet
- Knowledge and template content is appended automatically by the skill-loader

---

## `knowledge/` Directory

The `knowledge/` directory provides additional context files to the agent.

- **Location:** `src/agents/<cluster>/<agent-name>/knowledge/`
- **File format:** Only `.md` files are loaded; all other file types are ignored
- **Load order:** Files are sorted alphabetically for deterministic concatenation
- **Loader:** `loadKnowledgeDir()` in `src/lib/agents/skill-loader.ts`
- **Output:** Concatenated into the `knowledgeContext` field of `SkillDefinition`, separated by `\n\n---\n\n`
- **Optional:** The directory doesn't need to exist. If absent, `knowledgeContext` is an empty string.

---

## `templates/` Directory

The `templates/` directory provides output templates the agent can reference.

- **Location:** `src/agents/<cluster>/<agent-name>/templates/`
- **File format:** Only `.md` files are loaded; all other file types are ignored
- **Load order:** Files are sorted alphabetically
- **Loader:** `loadTemplatesDir()` in `src/lib/agents/skill-loader.ts`
- **Output:** Stored as `Record<string, string>` keyed by filename **without** the `.md` extension
- **Optional:** The directory doesn't need to exist. If absent, `templates` is an empty object.

---

## Memory Configuration

Each agent can persist learning across pipeline runs via `AgentMemoryStore`.

- **Storage path:** `.mat/agents/<agent-name>/state.json`
- **Memory entry types:** `learning`, `rejection`, `pattern`, `preference`
- **Schema:** `memoryEntrySchema` and `memoryStateSchema` in `src/lib/schemas/agent-schema.ts`
- **Limits:** Configurable `maxEntries` (default: 100) and `retentionDays` (default: 90)
- **Eviction:** FIFO when `maxEntries` is exceeded
- **Atomic writes:** Uses `.tmp` file + rename to prevent corruption

---

## Examples

### Example 1: Simple Agent (Trend Scout)

```yaml
---
name: trend-scout
description: >
  Expert trend researcher specializing in identifying viral content patterns,
  emerging topics, and platform-specific trends for marketing campaigns.
cluster: intelligence
model: haiku
tools:
  - WebSearch
  - WebFetch
  - Read
  - Glob
trustTier: builtin
schemaVersion: "1.0.0"
examples:
  - description: "SaaS product trend research"
    inputs:
      brandName: "TestBrand"
      productDomain: "SaaS"
      audienceType: "developers"
      platforms: ["reddit", "tiktok"]
---

# Trend Scout Agent

You are an expert trend researcher specializing in identifying viral content
patterns, emerging topics, and platform-specific trends.

## Your Expertise

- Real-time trend identification across Reddit, TikTok, Instagram, and Facebook
- Viral mechanics analysis
- Cultural moment detection
...
```

### Example 2: Full Permissions Agent (Reddit Publisher)

```yaml
---
name: reddit-publisher
description: >
  Reddit publishing specialist managing content submission to subreddits.
  Handles post formatting, flair selection, timing, and community rule compliance.
cluster: distribution
model: haiku
tools:
  - Read
  - Write
  - WebFetch
trustTier: builtin
schemaVersion: "1.0.0"
permissions:
  credentials:
    - reddit-oauth
  dataScopes:
    - pipeline-state
    - content-items
    - platform-metrics
  toolScopes:
    - Read
    - Write
    - WebFetch
---

# Reddit Publisher Agent

You are a Reddit publishing specialist managing content submission to subreddits.
...
```

---

## `examples` Field

The `examples` array provides test inputs for the `mat agents test` command.

```yaml
examples:
  - description: "SaaS product trend research"
    inputs:
      brandName: "TestBrand"
      productDomain: "SaaS"
      audienceType: "developers"
      platforms: ["reddit", "tiktok"]
```

Each example has:

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | Yes | Human-readable description of the test scenario |
| `inputs` | `Record<string, unknown>` | Yes | Key-value inputs to pass to the agent |

---

## Schema Versioning

The SKILL.md schema follows [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Examples |
|---|---|---|
| **Patch** | `1.0.x` | Documentation clarification, new optional field with default |
| **Minor** | `1.x.0` | New required field with automatic migration, new enum value |
| **Major** | `x.0.0` | Field rename, field removal, type change — requires migration guide |

The current schema version is exported as `CURRENT_SCHEMA_VERSION` from `src/lib/schemas/agent-schema.ts`.

When loading a SKILL.md, the skill-loader warns if the file's `schemaVersion` major version differs from the current version.

Migration guides are published in `docs/schema-migrations/`.

---

## Validation

### Automated Validation

Use the CLI command to validate SKILL.md files:

```bash
# Validate a specific agent
mat agents validate --path src/agents/intelligence/trend-scout

# Validate all agents
mat agents validate
```

The validate command runs:

1. **Sandbox validation** — `validateSkillMdSafety()` checks for code injection patterns (script tags, `eval()`, path traversal, etc.)
2. **Schema validation** — `agentDefinitionSchema` validates YAML front matter types and constraints

### Validation Output

On success:
```
✓ trend-scout — valid (schema 1.0.0)
```

On failure:
```
✗ bad-agent — 2 errors
  - name: String must contain at least 1 character(s)
  - cluster: Invalid enum value. Expected 'intelligence' | 'strategy' | ...
```
