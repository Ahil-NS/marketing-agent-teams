import {Command} from '@oclif/core'
import {editor, input, select} from '@inquirer/prompts'

import {readConfig, writeConfig} from '../../lib/config/index.js'
import {MATError} from '../../lib/utils/errors.js'

// Tone and style choices derived from brand-voice-examples.yaml profiles
const TONE_CHOICES = [
  {name: 'Professional — e.g. Enterprise B2B', value: 'professional'},
  {name: 'Friendly — e.g. Wellness Brand', value: 'friendly'},
  {name: 'Enthusiastic — e.g. Tech Startup', value: 'enthusiastic'},
  {name: 'Technical', value: 'technical'},
  {name: 'Authoritative — e.g. Enterprise B2B', value: 'authoritative'},
  {name: 'Playful — e.g. Casual Consumer', value: 'playful'},
  {name: 'Other (custom)', value: '__custom__'},
]

const STYLE_CHOICES = [
  {name: 'Formal — e.g. Enterprise B2B', value: 'formal'},
  {name: 'Conversational — e.g. Tech Startup, Casual Consumer', value: 'conversational'},
  {name: 'Minimalist', value: 'minimalist'},
  {name: 'Educational', value: 'educational'},
  {name: 'Inspirational — e.g. Wellness Brand', value: 'inspirational'},
  {name: 'Other (custom)', value: '__custom__'},
]

function isPresetTone(value: string): boolean {
  return TONE_CHOICES.some(c => c.value === value && c.value !== '__custom__')
}

function isPresetStyle(value: string): boolean {
  return STYLE_CHOICES.some(c => c.value === value && c.value !== '__custom__')
}

export default class ConfigVoice extends Command {
  static override description = 'Configure brand voice and tone settings'

  static override examples = [
    '<%= config.bin %> config voice',
  ]

  async run(): Promise<void> {
    const {raw, validated} = await readConfig(process.cwd())
    const existing = validated.brandVoice

    try {
      let tone = await select({
        message: 'Select brand tone:',
        choices: TONE_CHOICES,
        default: isPresetTone(existing.tone) ? existing.tone : '__custom__',
      })

      if (tone === '__custom__') {
        tone = await input({
          message: 'Enter custom tone:',
          default: isPresetTone(existing.tone) ? '' : existing.tone,
          validate: (value: string) => value.trim().length > 0 || 'Tone cannot be empty',
        })
      }

      let communicationStyle = await select({
        message: 'Select communication style:',
        choices: STYLE_CHOICES,
        default: isPresetStyle(existing.communicationStyle) ? existing.communicationStyle : '__custom__',
      })

      if (communicationStyle === '__custom__') {
        communicationStyle = await input({
          message: 'Enter custom communication style:',
          default: isPresetStyle(existing.communicationStyle) ? '' : existing.communicationStyle,
          validate: (value: string) => value.trim().length > 0 || 'Communication style cannot be empty',
        })
      }

      const principlesRaw = await editor({
        message: 'Enter brand principles (one per line):',
        default: existing.brandPrinciples.join('\n'),
      })

      const bannedRaw = await input({
        message: 'Enter banned phrases (comma-separated):',
        default: existing.bannedPhrases.join(', '),
      })

      const brandPrinciples = principlesRaw
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)

      const bannedPhrases = bannedRaw
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)

      raw.brandVoice = {tone, communicationStyle, brandPrinciples, bannedPhrases}
      await writeConfig(process.cwd(), raw)

      this.log('\nBrand voice configuration saved!\n')
      this.log(`  Tone:                ${tone}`)
      this.log(`  Communication Style: ${communicationStyle}`)
      this.log(`  Brand Principles:    ${brandPrinciples.length > 0 ? brandPrinciples.join(', ') : '(none)'}`)
      this.log(`  Banned Phrases:      ${bannedPhrases.length > 0 ? bannedPhrases.join(', ') : '(none)'}`)
    } catch (error) {
      if (error instanceof MATError) throw error
      // @inquirer/prompts throws on Ctrl+C
      this.log('\nBrand voice configuration cancelled.')
    }
  }
}
