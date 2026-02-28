import {Command} from '@oclif/core'

import {readConfig} from '../../lib/config/index.js'
import type {Config as ProjectConfig} from '../../lib/schemas/index.js'

export default class ConfigIndex extends Command {
  static override description = 'Display current configuration'
  static override enableJsonFlag = true

  async run(): Promise<ProjectConfig> {
    const {validated} = await readConfig(process.cwd())

    this.log('=== MAT Configuration ===')
    this.log('')
    this.log(`  Product Name:         ${validated.productName}`)
    this.log(`  Platforms:            ${validated.platforms.join(', ')}`)
    this.log(`  Skill Level:          ${validated.skillLevel}`)
    this.log('')
    this.log('  Brand Voice:')
    this.log(`    Tone:               ${validated.brandVoice.tone}`)
    this.log(`    Style:              ${validated.brandVoice.communicationStyle}`)
    this.log(`    Principles:         ${validated.brandVoice.brandPrinciples.length > 0 ? validated.brandVoice.brandPrinciples.join(', ') : '(none)'}`)
    this.log(`    Banned Phrases:     ${validated.brandVoice.bannedPhrases.length > 0 ? validated.brandVoice.bannedPhrases.join(', ') : '(none)'}`)
    this.log('')
    this.log('  Agents:')
    this.log(`    Default Model:      ${validated.agents.defaultModel}`)
    this.log(`    Budget Limit:       $${validated.agents.budgetLimit}`)
    const disabledAgents = Object.entries(validated.agents.toggles)
      .filter(([, toggle]) => !toggle.enabled)
      .map(([name]) => name)
    this.log(`    Agent Toggles:      ${disabledAgents.length > 0 ? `${disabledAgents.length} disabled (${disabledAgents.join(', ')})` : 'all enabled'}`)

    return validated
  }
}
