# Vertical Modules

## What Are Vertical Modules?

Vertical modules are industry-specific content libraries that give MAT agents
domain expertise. They contain templates, knowledge bases, and examples tailored
to a particular industry or niche. When a vertical module is active, agents use
its materials to produce content that matches the tone, terminology, and best
practices of that industry.

## Why Use Vertical Modules?

Without a vertical module, agents produce general-purpose marketing content.
With one, they understand industry-specific jargon, compliance requirements,
audience expectations, and content patterns that perform well in that niche.

## Module Structure

Each vertical module lives in `src/verticals/<vertical-name>/` and follows
this directory structure:

```
src/verticals/<vertical-name>/
  manifest.yaml          # Module metadata and configuration
  templates/             # Content templates for each platform
    reddit-post.md
    instagram-caption.md
    tiktok-script.md
    facebook-post.md
  knowledge/             # Domain knowledge files
    terminology.md       # Industry-specific terms and definitions
    audience.md          # Target audience profiles
    compliance.md        # Regulatory or policy constraints
    best-practices.md    # What works in this vertical
  examples/              # Example content for reference
    high-performing.md   # Real examples of successful content
    tone-guide.md        # Voice and tone reference
```

## manifest.yaml

```yaml
name: wellness
displayName: Wellness & Health
description: Content library for wellness brands, fitness coaches, and health products
version: 1.0.0
author: MAT Team
categories:
  - health
  - fitness
  - mindfulness
  - nutrition
platforms:
  - reddit
  - instagram
  - tiktok
  - facebook
```

## How to Create a Vertical Module

1. Scaffold the module:

```bash
mat create vertical --name my-industry
```

This creates the directory structure with placeholder files.

2. Populate the knowledge files with industry-specific information:
   - `terminology.md` -- key terms, acronyms, and definitions
   - `audience.md` -- demographic profiles, pain points, motivations
   - `compliance.md` -- regulations, restricted claims, required disclaimers
   - `best-practices.md` -- content strategies that work in this vertical

3. Create platform-specific templates in `templates/`:
   - Use `{{variable}}` placeholders for dynamic content
   - Include structure guidance (hook, body, CTA patterns)
   - Add platform-specific formatting notes

4. Add examples in `examples/`:
   - Curate high-performing content from the industry
   - Document tone and voice patterns

5. Fill in `manifest.yaml` with metadata.

6. Activate the module in your pipeline:

```bash
mat run --vertical wellness
```

## Available Vertical Modules

### wellness

Content library for wellness brands, fitness coaches, and health products.

- **Knowledge:** Health terminology, FDA disclaimer requirements, wellness audience
  profiles, supplement marketing compliance
- **Templates:** Transformation stories, tip lists, myth-busting posts, product
  spotlights
- **Platforms:** Reddit, Instagram, TikTok, Facebook
- **Compliance:** Includes FDA/FTC disclaimer templates and restricted health
  claim patterns

## Using Verticals in Pipeline Runs

Specify the vertical when running a pipeline:

```bash
mat run --vertical wellness --platforms reddit,instagram
```

The orchestrator loads the vertical module and injects its knowledge and templates
into each agent's context. Agents receive:

- Knowledge files appended to their system prompt
- Templates available as structured output guides
- Examples used as few-shot references

## Creating Community Verticals

Community members can contribute vertical modules by:

1. Creating the module structure locally
2. Testing with `mat agents validate --vertical my-industry`
3. Submitting a pull request to the community verticals repository

Community verticals run under the `community` trust tier unless reviewed
and promoted to `verified`.
