---
name: valid-agent
description: >
  A valid test agent for schema validation testing.
  This agent is used in automated tests.
cluster: intelligence
model: haiku
tools:
  - WebSearch
  - Read
trustTier: builtin
permissions:
  credentials: []
  dataScopes:
    - brand-config
    - trend-data
  toolScopes:
    - WebSearch
    - Read
---

# Valid Test Agent

You are a test agent used for validation testing.

## Your Expertise

- Testing SKILL.md file parsing
- Validating YAML front matter schemas

## Process

1. Accept test inputs
2. Process according to instructions
3. Return structured output

## Output Format

Always produce output as structured JSON.

## Quality Standards

- All output must be valid JSON
- All fields must be present
