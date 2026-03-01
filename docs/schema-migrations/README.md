# Schema Migrations

This directory contains migration guides for SKILL.md schema version changes.

When a **major version** bump occurs, a migration guide is published here explaining what changed and how to update existing SKILL.md files.

## Migration Index

| Version | Date | Type | Description |
|---|---|---|---|
| [1.0.0](1.0.0.md) | 2026-03-01 | Baseline | Initial schema release |

## Version Bump Policy

| Change Type | Version Bump | Examples |
|---|---|---|
| **Patch** | `1.0.x` | Documentation clarification, new optional field with default |
| **Minor** | `1.x.0` | New required field with automatic migration, new enum value |
| **Major** | `x.0.0` | Field rename, field removal, type change — requires migration guide here |

## How to Use

When upgrading MAT to a version with a new major schema version:

1. Check the migration guide for your current → target version
2. Update each SKILL.md file according to the guide
3. Run `mat agents validate` to confirm all files pass validation
