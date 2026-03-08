import {readdir, readFile, writeFile, mkdir} from 'node:fs/promises'
import {join} from 'node:path'

export interface CampaignRecord {
  id: string
  name: string
  platforms: string[]
  status: 'completed' | 'partial' | 'failed'
  contentCount: number
  totalCost: number
  startedAt: string
  completedAt: string
  config: {
    dryRun: boolean
    budgetLimit: number
  }
}

/**
 * Persists campaign records to .mat/history/campaigns/<id>.json
 */
export class CampaignStore {
  private readonly campaignDir: string

  constructor(projectRoot: string) {
    this.campaignDir = join(projectRoot, '.mat', 'history', 'campaigns')
  }

  async save(campaign: CampaignRecord): Promise<void> {
    await mkdir(this.campaignDir, {recursive: true})
    const filePath = join(this.campaignDir, `${campaign.id}.json`)
    await writeFile(filePath, JSON.stringify(campaign, null, 2), 'utf-8')
  }

  async getById(id: string): Promise<CampaignRecord | null> {
    try {
      const raw = await readFile(join(this.campaignDir, `${id}.json`), 'utf-8')
      return JSON.parse(raw) as CampaignRecord
    } catch {
      return null
    }
  }

  async list(): Promise<CampaignRecord[]> {
    let files: string[]
    try {
      files = await readdir(this.campaignDir)
    } catch {
      return []
    }

    const campaigns: CampaignRecord[] = []
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      try {
        const raw = await readFile(join(this.campaignDir, file), 'utf-8')
        campaigns.push(JSON.parse(raw) as CampaignRecord)
      } catch {
        continue
      }
    }

    // Sort newest first
    campaigns.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return campaigns
  }
}
