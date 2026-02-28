---
name: community-agent
description: >
  A community-contributed agent with unreviewed trust tier.
cluster: intelligence
model: haiku
tools:
  - Read
trustTier: community
permissions:
  credentials: []
  dataScopes: []
  toolScopes:
    - Read
---

# Community Agent (Unreviewed)

This is a community-contributed agent with restricted permissions.

## Process

1. Accept inputs within sandboxed scope
2. Process with restricted tool access
3. Return output

## Quality Standards

- Must operate within restricted permissions
