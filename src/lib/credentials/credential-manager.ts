import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { z } from 'zod'

import type { CredentialContext, CredentialEntry, KeychainAdapter, Platform, PlatformCredential, TokenData } from './types.js'
import { CredentialNotFoundError, CredentialStoreError } from './errors.js'
import { platformsMetadataSchema } from '../schemas/platform-schema.js'

class ImmutableCredentialContext implements ReadonlyMap<string, string> {
  private readonly _map: Map<string, string>

  constructor(entries: Iterable<[string, string]>) {
    this._map = new Map(entries)
  }

  get size(): number { return this._map.size }
  get(key: string): string | undefined { return this._map.get(key) }
  has(key: string): boolean { return this._map.has(key) }
  entries(): MapIterator<[string, string]> { return this._map.entries() }
  keys(): MapIterator<string> { return this._map.keys() }
  values(): MapIterator<string> { return this._map.values() }
  forEach(cb: (value: string, key: string, map: ReadonlyMap<string, string>) => void): void {
    this._map.forEach((v, k) => cb(v, k, this))
  }

  [Symbol.iterator](): MapIterator<[string, string]> { return this._map[Symbol.iterator]() }
  get [Symbol.toStringTag](): string { return 'ImmutableCredentialContext' }
}

const SERVICE_NAME = 'marketing-agent-teams'

const tokenDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
})

interface PlatformsMetadata {
  platforms: PlatformCredential[]
}

export class CredentialManager {
  private readonly keychain: KeychainAdapter
  private readonly projectRoot: string

  constructor(keychain: KeychainAdapter, projectRoot: string) {
    this.keychain = keychain
    this.projectRoot = projectRoot
  }

  async store(platform: Platform, tokens: TokenData, scopes: string[] = []): Promise<void> {
    try {
      await this.keychain.setPassword(SERVICE_NAME, platform, JSON.stringify(tokens))
    } catch (error) {
      throw new CredentialStoreError(
        platform,
        error instanceof Error ? error.message : String(error),
      )
    }

    const metadata = await this.loadMetadata()
    const existing = metadata.platforms.findIndex((p) => p.platform === platform)
    const entry: PlatformCredential = {
      platform,
      connected: true,
      expiresAt: tokens.expiresAt,
      scopes,
      connectedAt: new Date().toISOString(),
    }

    if (existing >= 0) {
      metadata.platforms[existing] = entry
    } else {
      metadata.platforms.push(entry)
    }

    await this.saveMetadata(metadata)
  }

  async retrieve(platform: Platform): Promise<CredentialEntry> {
    const raw = await this.keychain.getPassword(SERVICE_NAME, platform)
    if (!raw) {
      throw new CredentialNotFoundError(platform)
    }

    const parsed = JSON.parse(raw)
    const result = tokenDataSchema.safeParse(parsed)
    if (!result.success) {
      throw new CredentialStoreError(platform, 'Stored credential data is corrupted or has an invalid format')
    }

    return { platform, tokens: result.data }
  }

  async remove(platform: Platform): Promise<void> {
    const raw = await this.keychain.getPassword(SERVICE_NAME, platform)
    if (!raw) {
      throw new CredentialNotFoundError(platform)
    }

    await this.keychain.deletePassword(SERVICE_NAME, platform)

    const metadata = await this.loadMetadata()
    metadata.platforms = metadata.platforms.filter((p) => p.platform !== platform)
    await this.saveMetadata(metadata)
  }

  async resolveForAgent(
    _agentName: string,
    permissions?: { credentials?: string[] },
  ): Promise<CredentialContext> {
    const declaredCredentials = permissions?.credentials ?? []
    if (declaredCredentials.length === 0) {
      return new ImmutableCredentialContext([])
    }

    const entries: [string, string][] = []
    for (const credKey of declaredCredentials) {
      const token = await this.resolveToken(credKey)
      if (token !== null) {
        entries.push([credKey, token])
      }
    }

    return new ImmutableCredentialContext(entries)
  }

  private async resolveToken(credKey: string): Promise<string | null> {
    const raw = await this.keychain.getPassword(SERVICE_NAME, credKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    const result = tokenDataSchema.safeParse(parsed)
    if (!result.success) {
      throw new CredentialStoreError(credKey, 'Stored credential data is corrupted or has an invalid format')
    }

    return result.data.accessToken
  }

  async list(): Promise<PlatformCredential[]> {
    const metadata = await this.loadMetadata()
    return metadata.platforms
  }

  private metadataPath(): string {
    return join(this.projectRoot, '.mat', 'credentials', 'platforms.json')
  }

  private async loadMetadata(): Promise<PlatformsMetadata> {
    try {
      const raw = await readFile(this.metadataPath(), 'utf-8')
      const parsed = JSON.parse(raw)
      const result = platformsMetadataSchema.safeParse(parsed)
      if (!result.success) {
        return { platforms: [] }
      }
      return result.data as PlatformsMetadata
    } catch {
      return { platforms: [] }
    }
  }

  private async saveMetadata(metadata: PlatformsMetadata): Promise<void> {
    const filePath = this.metadataPath()
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf-8')
  }
}
