import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {join} from 'node:path'

export interface ContentRecord {
  id: string
  platform: string
  campaignId: string
  contentType: string
  title?: string
  status: 'created' | 'approved' | 'published' | 'rejected'
  publishUrl?: string
  createdAt: string
  publishedAt?: string
  metrics?: Record<string, number>
}

export interface ContentIndex {
  items: ContentRecord[]
  updatedAt: string
}

/**
 * Content index stored at .mat/history/content-index.json.
 * Tracks every content item across all campaigns.
 */
export class ContentStore {
  private readonly indexPath: string

  constructor(projectRoot: string) {
    this.indexPath = join(projectRoot, '.mat', 'history', 'content-index.json')
  }

  async addItems(items: ContentRecord[]): Promise<void> {
    const index = await this.load()
    index.items.push(...items)
    index.updatedAt = new Date().toISOString()
    await this.save(index)
  }

  async updateItem(id: string, updates: Partial<ContentRecord>): Promise<void> {
    const index = await this.load()
    const item = index.items.find((i) => i.id === id)
    if (item) {
      Object.assign(item, updates)
      index.updatedAt = new Date().toISOString()
      await this.save(index)
    }
  }

  async getAll(): Promise<ContentRecord[]> {
    const index = await this.load()
    return index.items
  }

  async getByCampaign(campaignId: string): Promise<ContentRecord[]> {
    const index = await this.load()
    return index.items.filter((i) => i.campaignId === campaignId)
  }

  async getByPlatform(platform: string): Promise<ContentRecord[]> {
    const index = await this.load()
    return index.items.filter((i) => i.platform === platform)
  }

  private async load(): Promise<ContentIndex> {
    try {
      const raw = await readFile(this.indexPath, 'utf-8')
      return JSON.parse(raw) as ContentIndex
    } catch {
      return {items: [], updatedAt: new Date().toISOString()}
    }
  }

  private async save(index: ContentIndex): Promise<void> {
    await mkdir(join(this.indexPath, '..'), {recursive: true})
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8')
  }
}
