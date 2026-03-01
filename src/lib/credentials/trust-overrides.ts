import {access, mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

import {z} from 'zod'

import {MATError} from '../utils/errors.js'
import type {TrustTier} from './types.js'

/**
 * Schema for a single trust override entry.
 */
export const trustOverrideSchema = z.object({
  /** Target trust tier after promotion */
  trustTier: z.enum(['verified', 'community']),
  /** ISO 8601 timestamp of when the override was applied */
  promotedAt: z.string().datetime(),
  /** Who applied the override */
  promotedBy: z.string().min(1),
  /** Reason for the override */
  reason: z.string().min(1),
})

export type TrustOverride = z.infer<typeof trustOverrideSchema>

/**
 * Schema for the full trust-overrides.json file.
 * Record keyed by agent name (e.g., '@community/linkedin-agent').
 */
export const trustOverridesFileSchema = z.record(z.string(), trustOverrideSchema)

export type TrustOverridesFile = z.infer<typeof trustOverridesFileSchema>

export const TRUST_OVERRIDE_INVALID_PROMOTION = 'TRUST_OVERRIDE_INVALID_PROMOTION'
export const TRUST_OVERRIDE_BUILTIN_IMMUTABLE = 'TRUST_OVERRIDE_BUILTIN_IMMUTABLE'
export const TRUST_OVERRIDE_READ_FAILED = 'TRUST_OVERRIDE_READ_FAILED'
export const TRUST_OVERRIDE_WRITE_FAILED = 'TRUST_OVERRIDE_WRITE_FAILED'
export const TRUST_OVERRIDE_CORRUPTED = 'TRUST_OVERRIDE_CORRUPTED'

export class TrustOverrideError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
  ) {
    super(message, code, reason, resolution, 'trust-overrides', 'permanent')
  }
}

/**
 * CRUD operations for .mat/config/trust-overrides.json.
 * Uses atomic file writes (.tmp + rename) to prevent corruption.
 */
export class TrustOverrideStore {
  private readonly overridesPath: string

  constructor(matDir: string = '.mat') {
    this.overridesPath = join(matDir, 'config', 'trust-overrides.json')
  }

  /** Load all trust overrides from disk. Returns empty record if file doesn't exist. */
  async loadOverrides(): Promise<TrustOverridesFile> {
    try {
      await access(this.overridesPath)
    } catch {
      return {}
    }

    let raw: string
    try {
      raw = await readFile(this.overridesPath, 'utf-8')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new TrustOverrideError(
        `Failed to read trust overrides`,
        TRUST_OVERRIDE_READ_FAILED,
        `Could not read file: ${this.overridesPath} (${detail})`,
        `Check file permissions. Run: ls -la "${this.overridesPath}"`,
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new TrustOverrideError(
        `Corrupted trust overrides file`,
        TRUST_OVERRIDE_CORRUPTED,
        `File contains invalid JSON: ${this.overridesPath} (${detail})`,
        `Delete the corrupted file and re-apply trust overrides: rm "${this.overridesPath}"`,
      )
    }

    const validated = trustOverridesFileSchema.safeParse(parsed)
    if (!validated.success) {
      throw new TrustOverrideError(
        `Invalid trust overrides structure`,
        TRUST_OVERRIDE_CORRUPTED,
        `Schema validation failed: ${validated.error.message}`,
        `Delete the corrupted file and re-apply trust overrides: rm "${this.overridesPath}"`,
      )
    }

    return validated.data
  }

  /** Save the full trust overrides to disk with atomic write. */
  async saveOverrides(overrides: TrustOverridesFile): Promise<void> {
    const dir = dirname(this.overridesPath)
    await mkdir(dir, {recursive: true})

    const tmpPath = `${this.overridesPath}.tmp`
    try {
      await writeFile(tmpPath, JSON.stringify(overrides, null, 2), 'utf-8')
      await rename(tmpPath, this.overridesPath)
    } catch (error) {
      // Clean up temp file on failure
      try {
        await unlink(tmpPath)
      } catch {
        // Ignore cleanup failure
      }
      const detail = error instanceof Error ? error.message : String(error)
      throw new TrustOverrideError(
        `Failed to write trust overrides`,
        TRUST_OVERRIDE_WRITE_FAILED,
        `Could not write file: ${this.overridesPath} (${detail})`,
        `Check file permissions and disk space. Directory: "${dir}"`,
      )
    }
  }

  /**
   * Set or update a trust override for an agent.
   *
   * Validation rules:
   * - Cannot promote to 'builtin' — only core platform agents can have builtin tier
   * - Cannot override builtin agents — use isBuiltin to signal this
   *
   * @param agentName - Agent identifier (e.g., '@community/linkedin-agent')
   * @param tier - Target trust tier ('verified' or 'community')
   * @param promotedBy - Who applied the override (default: 'user')
   * @param reason - Reason for the override
   * @param isBuiltin - Whether the agent is a builtin agent (prevents override)
   */
  async setOverride(
    agentName: string,
    tier: TrustTier,
    promotedBy: string = 'user',
    reason: string = 'Manually promoted via CLI',
    isBuiltin: boolean = false,
  ): Promise<TrustOverride> {
    // Block promotion to builtin
    if (tier === 'builtin') {
      throw new TrustOverrideError(
        `Cannot promote agent to builtin tier`,
        TRUST_OVERRIDE_INVALID_PROMOTION,
        `Only core platform agents shipped with the npm package can have builtin trust tier`,
        `Use 'verified' as the target tier instead: mat agents trust ${agentName} verified`,
      )
    }

    // Block overriding builtin agents
    if (isBuiltin) {
      throw new TrustOverrideError(
        `Cannot modify trust tier of builtin agent '${agentName}'`,
        TRUST_OVERRIDE_BUILTIN_IMMUTABLE,
        `Builtin agents always have 'builtin' trust tier — it cannot be overridden`,
        `Only community-sourced agents can have their trust tier modified`,
      )
    }

    const overrides = await this.loadOverrides()
    const override: TrustOverride = {
      trustTier: tier as 'verified' | 'community',
      promotedAt: new Date().toISOString(),
      promotedBy,
      reason,
    }
    overrides[agentName] = override
    await this.saveOverrides(overrides)
    return override
  }

  /** Remove a trust override, resetting the agent to default 'community' tier. */
  async removeOverride(agentName: string): Promise<boolean> {
    const overrides = await this.loadOverrides()
    if (!(agentName in overrides)) {
      return false
    }
    delete overrides[agentName]
    await this.saveOverrides(overrides)
    return true
  }

  /** Get the trust override for a specific agent, or undefined if none exists. */
  async getOverride(agentName: string): Promise<TrustOverride | undefined> {
    const overrides = await this.loadOverrides()
    return overrides[agentName]
  }

  /**
   * Get a flat map of agent name → trust tier from all overrides.
   * Used as input to getEffectiveTrustTier().
   */
  async getOverridesMap(): Promise<Record<string, TrustTier>> {
    const overrides = await this.loadOverrides()
    const result: Record<string, TrustTier> = {}
    for (const [name, entry] of Object.entries(overrides)) {
      result[name] = entry.trustTier
    }
    return result
  }
}
