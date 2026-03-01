import type {PlatformAdapter, PlatformName} from './types.js'
import {PlatformNotRegisteredError} from './errors.js'

export class AdapterRegistry {
  private adapters = new Map<PlatformName, PlatformAdapter>()

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter)
  }

  get(platform: PlatformName): PlatformAdapter {
    const adapter = this.adapters.get(platform)
    if (!adapter) throw new PlatformNotRegisteredError(platform)
    return adapter
  }

  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values())
  }

  has(platform: PlatformName): boolean {
    return this.adapters.has(platform)
  }

  unregister(platform: PlatformName): boolean {
    return this.adapters.delete(platform)
  }

  clear(): void {
    this.adapters.clear()
  }

  get size(): number {
    return this.adapters.size
  }
}
