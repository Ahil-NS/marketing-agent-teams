import {access, mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

import {z} from 'zod'

import {MATError} from '../utils/errors.js'

/**
 * Schema for a single installed community agent registry entry.
 */
export const installedAgentSchema = z.object({
  /** npm package name */
  package: z.string().min(1),
  /** Installed package version */
  version: z.string().min(1),
  /** ISO 8601 timestamp of installation */
  installedAt: z.string().datetime(),
  /** Trust tier — always 'community' for installed agents */
  trustTier: z.literal('community'),
  /** Agent names discovered in the package */
  agents: z.array(z.string().min(1)),
  /** Whether this agent is enabled for pipeline execution */
  enabled: z.boolean(),
})

export type InstalledAgent = z.infer<typeof installedAgentSchema>

/**
 * Schema for the full installed agents registry.
 * Record keyed by npm package name.
 */
export const installedAgentsRegistrySchema = z.record(z.string(), installedAgentSchema)

export type InstalledAgentsRegistryData = z.infer<typeof installedAgentsRegistrySchema>

export class InstalledAgentRegistryError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
  ) {
    super(message, code, reason, resolution, 'installed-agents', 'permanent')
  }
}

/**
 * CRUD operations for .mat/config/installed-agents.json.
 * Uses atomic file writes (.tmp + rename) following the memory-store pattern.
 */
export class InstalledAgentsRegistry {
  private readonly registryPath: string

  constructor(matDir: string = '.mat') {
    this.registryPath = join(matDir, 'config', 'installed-agents.json')
  }

  /** Load the full registry from disk. Returns empty record if file doesn't exist. */
  async loadRegistry(): Promise<InstalledAgentsRegistryData> {
    try {
      await access(this.registryPath)
    } catch {
      return {}
    }

    let raw: string
    try {
      raw = await readFile(this.registryPath, 'utf-8')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new InstalledAgentRegistryError(
        `Failed to read installed agents registry`,
        'REGISTRY_READ_FAILED',
        `Could not read file: ${this.registryPath} (${detail})`,
        `Check file permissions. Run: ls -la "${this.registryPath}"`,
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new InstalledAgentRegistryError(
        `Corrupted installed agents registry`,
        'REGISTRY_CORRUPTED',
        `File contains invalid JSON: ${this.registryPath} (${detail})`,
        `Delete the corrupted file and reinstall community agents: rm "${this.registryPath}"`,
      )
    }

    const validated = installedAgentsRegistrySchema.safeParse(parsed)
    if (!validated.success) {
      throw new InstalledAgentRegistryError(
        `Invalid installed agents registry structure`,
        'REGISTRY_CORRUPTED',
        `Schema validation failed: ${validated.error.message}`,
        `Delete the corrupted file and reinstall community agents: rm "${this.registryPath}"`,
      )
    }

    return validated.data
  }

  /** Save the full registry to disk. Uses atomic write (.tmp + rename). */
  async saveRegistry(registry: InstalledAgentsRegistryData): Promise<void> {
    const validated = installedAgentsRegistrySchema.safeParse(registry)
    if (!validated.success) {
      throw new InstalledAgentRegistryError(
        `Invalid registry data`,
        'REGISTRY_WRITE_FAILED',
        `Schema validation failed before write: ${validated.error.message}`,
        'Ensure the registry object matches InstalledAgentsRegistry schema before saving.',
      )
    }

    const tmpPath = this.registryPath + '.tmp'

    try {
      await mkdir(dirname(this.registryPath), {recursive: true})
      await writeFile(tmpPath, JSON.stringify(registry, null, 2), 'utf-8')
      await rename(tmpPath, this.registryPath)
    } catch (error) {
      try {
        await unlink(tmpPath)
      } catch {
        /* ignore cleanup failure */
      }

      const detail = error instanceof Error ? error.message : String(error)
      throw new InstalledAgentRegistryError(
        `Failed to write installed agents registry`,
        'REGISTRY_WRITE_FAILED',
        `Could not write file: ${this.registryPath} (${detail})`,
        'Check disk space and directory permissions for: ' + dirname(this.registryPath),
      )
    }
  }

  /** Add a community agent to the registry. */
  async addAgent(packageName: string, entry: InstalledAgent): Promise<void> {
    const registry = await this.loadRegistry()
    registry[packageName] = entry
    await this.saveRegistry(registry)
  }

  /** Remove a community agent from the registry. Returns true if removed, false if not found. */
  async removeAgent(packageName: string): Promise<boolean> {
    const registry = await this.loadRegistry()
    if (!(packageName in registry)) {
      return false
    }

    delete registry[packageName]
    await this.saveRegistry(registry)
    return true
  }

  /** Get a single agent entry by package name. Returns undefined if not found. */
  async getAgent(packageName: string): Promise<InstalledAgent | undefined> {
    const registry = await this.loadRegistry()
    return registry[packageName]
  }

  /** List all installed agents. */
  async listAll(): Promise<InstalledAgentsRegistryData> {
    return this.loadRegistry()
  }
}
