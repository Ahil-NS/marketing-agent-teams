# Marketing Agent Teams (MAT)

CLI-driven multi-agent AI system for social media marketing — automated trend research, content creation, optimization, quality review, and publishing across Reddit, TikTok, Facebook, and Instagram.

## Overview

MAT orchestrates **23 specialized AI agents** organized into **7 functional clusters** through a 6-stage pipeline. Each agent is defined as a SKILL.md file (YAML front matter + markdown system prompt) and executed via the Claude Agent SDK through an `AgentExecutor` adapter interface.

**Key design decisions:**
- **Claude Code CLI authentication** — no API key management; users run `claude login` once
- **AgentExecutor adapter** — thin interface (`execute()`, `estimateCost()`) with `ClaudeAgentExecutor` as MVP; designed for future multi-provider support
- **SKILL.md agent definitions** — declarative, versionable, community-contributable
- **Optional tmux integration** — `mat run --tmux` for real-time pipeline visualization with per-stage panes

## Pipeline Stages

```
Intelligence → Content Creation → Optimization → Quality Gates → Review → Distribution
```

Each stage runs one or more agents from the relevant cluster. Output flows forward through the pipeline. The human review queue sits between quality gates and distribution.

## Agent Clusters (MVP)

| Cluster | Agents | Purpose |
|---|---|---|
| **Intelligence & Research** | 5 | Trend Scout, Competitor Intel, Viral Decoder, Audience Researcher, Channel Optimizer |
| **Strategy & Planning** | 3 | Campaign Architect, Content Calendar, Seasonal Campaign |
| **Content Creation** | 7 | Reddit/TikTok/Facebook/Instagram Specialists, Hook Writer, Content Atomizer, Image/Video Prompt Generator |
| **Optimization** | 3 | SEO Optimizer, Content Humanizer, Hashtag Strategist |
| **Quality & Compliance** | 4 | Brand Voice Guardian, Compliance Shield, Fact Checker, Sensitivity Reviewer |
| **Distribution** | 1 | Multi-platform Publisher (via platform adapters) |

## Technical Stack

| Component | Technology | Notes |
|---|---|---|
| CLI Framework | oclif v4.8.1 | TypeScript-first, plugin architecture |
| AI Provider (MVP) | Claude Agent SDK 0.2.63 (exact) | Via Claude Code CLI auth |
| Agent Definitions | SKILL.md | YAML front matter + markdown prompt |
| Credential Storage | @aspect-build/keytar | Platform OAuth tokens in OS keychain |
| Config/State | YAML + JSON in `.mat/` | Human-readable, Git-diffable |
| Validation | Zod v4.3.6 | Schema validation for config, agents, outputs |
| Pipeline Visualization | tmux (optional) | 6-pane layout, status bar, log capture |

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

## CLI Commands

| Command | Purpose |
|---|---|
| `mat install` | Interactive setup wizard — scaffolds `.mat/` project directory |
| `mat run` | Execute the full marketing pipeline |
| `mat run --tmux` | Execute with tmux real-time visualization |
| `mat attach` | Reattach to a running tmux pipeline session |
| `mat review` | Open the content review queue |
| `mat config` | Manage brand voice, platforms, agents, budgets |
| `mat config platforms` | Add/remove/list connected social platforms |
| `mat config agents` | Enable/disable/configure individual agents |
| `mat agents` | List, add, remove, trust community agents |
| `mat status` | Show pipeline run history and current state |

## Project Structure

```
.mat/                        # Project directory (created by mat install)
  config.yaml                # Brand voice, platforms, agent settings
  state/                     # Pipeline runs, review queue, retry queue
  agents/                    # Per-agent persistent memory
  content/                   # Generated content per run
  credentials/               # Token metadata (secrets in OS keychain)
  logs/<run-id>/             # Per-run, per-stage log files
```

## Architecture

4-layer boundary architecture:

```
CLI Layer           → oclif commands (thin delegates)
Orchestration Layer → Pipeline engine, stage runner, tmux manager
Domain Layer        → Agent executor, SKILL.md loader, content models
Infrastructure Layer → Credential manager, platform adapters, file I/O
```

See [architecture.md](_bmad-output/planning-artifacts/architecture.md) for full details.

## Roadmap

- **Sprint 1 (MVP):** Core pipeline, 23 agents, 4 platforms, CLI, tmux, review queue
- **Wave 2:** Additional AI providers via AgentExecutor adapter (OpenAI, etc.)
- **Wave 3:** Community agent marketplace, web review UI, multi-client management

## License

MIT
