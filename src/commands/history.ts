import {Command, Flags} from '@oclif/core'

import {CampaignStore} from '../lib/history/campaign-store.js'
import {ContentStore} from '../lib/history/content-store.js'

export default class History extends Command {
  static override description = 'View campaign history and content records'

  static override flags = {
    list: Flags.boolean({
      description: 'List all campaigns',
      default: false,
    }),
    show: Flags.string({
      description: 'Show details for a specific campaign ID',
    }),
    export: Flags.string({
      description: 'Export history to file (json or csv)',
      options: ['json', 'csv'],
    }),
    platform: Flags.string({
      description: 'Filter by platform',
    }),
  }

  static override args = {}

  async run(): Promise<void> {
    const {flags} = await this.parse(History)
    const projectRoot = process.cwd()
    const campaignStore = new CampaignStore(projectRoot)
    const contentStore = new ContentStore(projectRoot)

    if (flags.show) {
      await this.showCampaign(campaignStore, contentStore, flags.show)
      return
    }

    if (flags.export) {
      await this.exportHistory(campaignStore, contentStore, flags.export, flags.platform)
      return
    }

    // Default: list campaigns
    await this.listCampaigns(campaignStore)
  }

  private async listCampaigns(store: CampaignStore): Promise<void> {
    const campaigns = await store.list()

    if (campaigns.length === 0) {
      this.log('No campaigns found. Run `mat run` to create your first campaign.')
      return
    }

    this.log('Campaign History:\n')
    this.log(
      'ID'.padEnd(38) +
      'Status'.padEnd(12) +
      'Platforms'.padEnd(30) +
      'Content'.padEnd(10) +
      'Cost'.padEnd(10) +
      'Date',
    )
    this.log('-'.repeat(110))

    for (const c of campaigns) {
      this.log(
        c.id.padEnd(38) +
        c.status.padEnd(12) +
        c.platforms.join(', ').padEnd(30) +
        String(c.contentCount).padEnd(10) +
        `$${c.totalCost.toFixed(2)}`.padEnd(10) +
        c.startedAt.slice(0, 10),
      )
    }

    this.log(`\n${campaigns.length} campaign(s) total.`)
  }

  private async showCampaign(
    campaignStore: CampaignStore,
    contentStore: ContentStore,
    id: string,
  ): Promise<void> {
    const campaign = await campaignStore.getById(id)
    if (!campaign) {
      this.error(`Campaign not found: ${id}`)
      return
    }

    this.log(`Campaign: ${campaign.name || campaign.id}`)
    this.log(`Status: ${campaign.status}`)
    this.log(`Platforms: ${campaign.platforms.join(', ')}`)
    this.log(`Started: ${campaign.startedAt}`)
    this.log(`Completed: ${campaign.completedAt}`)
    this.log(`Cost: $${campaign.totalCost.toFixed(2)}`)
    this.log(`Dry Run: ${campaign.config.dryRun}`)
    this.log('')

    const content = await contentStore.getByCampaign(id)
    if (content.length > 0) {
      this.log(`Content Items (${content.length}):\n`)
      for (const item of content) {
        const url = item.publishUrl ? ` -> ${item.publishUrl}` : ''
        this.log(`  [${item.platform}] ${item.title ?? item.contentType} (${item.status})${url}`)
      }
    }
  }

  private async exportHistory(
    campaignStore: CampaignStore,
    contentStore: ContentStore,
    format: string,
    platform?: string,
  ): Promise<void> {
    const campaigns = await campaignStore.list()
    let content = await contentStore.getAll()

    if (platform) {
      content = content.filter((c) => c.platform === platform)
    }

    if (format === 'json') {
      const data = {campaigns, content, exportedAt: new Date().toISOString()}
      this.log(JSON.stringify(data, null, 2))
    } else if (format === 'csv') {
      this.log('id,platform,campaign_id,content_type,status,publish_url,created_at,published_at')
      for (const item of content) {
        this.log(
          `${item.id},${item.platform},${item.campaignId},${item.contentType},${item.status},${item.publishUrl ?? ''},${item.createdAt},${item.publishedAt ?? ''}`,
        )
      }
    }
  }
}
