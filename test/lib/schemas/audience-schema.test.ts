import {describe, it, expect} from 'vitest'

import {
  audienceProfileSchema,
  channelScoreSchema,
  audienceResearchInputsSchema,
} from '../../../src/lib/schemas/audience-schema.js'

import validAudienceProfile from '../../fixtures/responses/claude-audience-profile.json'
import validChannelScore from '../../fixtures/responses/claude-channel-score.json'

describe('audienceProfileSchema', () => {
  it('validates correct structure', () => {
    const result = audienceProfileSchema.safeParse(validAudienceProfile)
    expect(result.success).toBe(true)
  })

  it('rejects missing profileId', () => {
    const {profileId: _, ...profile} = validAudienceProfile
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('rejects missing brandName', () => {
    const {brandName: _, ...profile} = validAudienceProfile
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('requires at least 2 segments', () => {
    const profile = {...validAudienceProfile, segments: [validAudienceProfile.segments[0]]}
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('accepts exactly 2 segments', () => {
    const profile = {...validAudienceProfile, segments: validAudienceProfile.segments.slice(0, 2)}
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(true)
  })

  it('requires segment demographics to have ageRange', () => {
    const profile = structuredClone(validAudienceProfile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (profile.segments[0].demographics as any).ageRange
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('requires segment psychographics to have valsType', () => {
    const profile = structuredClone(validAudienceProfile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (profile.segments[0].psychographics as any).valsType
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 pain point', () => {
    const profile = {...validAudienceProfile, painPoints: []}
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('validates pain point severity enum', () => {
    const profile = structuredClone(validAudienceProfile)
    profile.painPoints[0].severity = 'extreme' as 'high'
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 persona', () => {
    const profile = {...validAudienceProfile, personas: []}
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('requires personas to have at least 3 behavioral indicators', () => {
    const profile = structuredClone(validAudienceProfile)
    profile.personas[0].behavioralIndicators = ['a', 'b']
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('validates platform enum in platformUsage', () => {
    const profile = structuredClone(validAudienceProfile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile.platformUsage[0].platform = 'twitter' as any
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 content preference', () => {
    const profile = {...validAudienceProfile, contentPreferences: []}
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('validates content preference engagementLevel enum', () => {
    const profile = structuredClone(validAudienceProfile)
    profile.contentPreferences[0].engagementLevel = 'very-high' as 'high'
    const result = audienceProfileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })
})

describe('channelScoreSchema', () => {
  it('validates correct structure', () => {
    const result = channelScoreSchema.safeParse(validChannelScore)
    expect(result.success).toBe(true)
  })

  it('rejects missing scoreId', () => {
    const {scoreId: _, ...score} = validChannelScore
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('rejects missing audienceProfileId', () => {
    const {audienceProfileId: _, ...score} = validChannelScore
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 platform score', () => {
    const score = {...validChannelScore, platformScores: []}
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('validates fitScore is between 0 and 1', () => {
    const score = structuredClone(validChannelScore)
    score.platformScores[0].fitScore = 1.5
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('rejects negative fitScore', () => {
    const score = structuredClone(validChannelScore)
    score.platformScores[0].fitScore = -0.1
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('validates audienceOverlap is between 0 and 1', () => {
    const score = structuredClone(validChannelScore)
    score.platformScores[0].audienceOverlap = 2.0
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('validates engagementPotential is between 0 and 1', () => {
    const score = structuredClone(validChannelScore)
    score.platformScores[0].engagementPotential = -0.5
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('validates priority enum values', () => {
    const score = structuredClone(validChannelScore)
    score.platformScores[0].priority = 'tertiary' as 'primary'
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 recommendation', () => {
    const score = {...validChannelScore, recommendations: []}
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 posting frequency entry', () => {
    const score = {...validChannelScore, postingFrequency: []}
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 content format recommendation', () => {
    const score = {...validChannelScore, contentFormatRecommendations: []}
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('validates contentFormatRecommendation expectedEngagement enum', () => {
    const score = structuredClone(validChannelScore)
    score.contentFormatRecommendations[0].expectedEngagement = 'very-high' as 'high'
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('requires crossPlatformStrategy string', () => {
    const {crossPlatformStrategy: _, ...score} = validChannelScore
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })

  it('rejects empty crossPlatformStrategy', () => {
    const score = {...validChannelScore, crossPlatformStrategy: ''}
    const result = channelScoreSchema.safeParse(score)
    expect(result.success).toBe(false)
  })
})

describe('audienceResearchInputsSchema', () => {
  it('validates complete inputs', () => {
    const inputs = {
      brandConfig: {
        brandName: 'WellnessApp',
        productDomain: 'health and wellness',
        tone: 'professional',
        communicationStyle: 'clear and direct',
        productName: 'WellnessApp',
      },
      verticalContext: 'Health vertical context',
      competitorData: 'CompetitorCo data',
    }
    const result = audienceResearchInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('validates minimal inputs (only required fields)', () => {
    const inputs = {
      brandConfig: {
        brandName: 'TestBrand',
        productDomain: 'SaaS',
      },
    }
    const result = audienceResearchInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('rejects missing brandName', () => {
    const inputs = {
      brandConfig: {
        productDomain: 'SaaS',
      },
    }
    const result = audienceResearchInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects missing productDomain', () => {
    const inputs = {
      brandConfig: {
        brandName: 'TestBrand',
      },
    }
    const result = audienceResearchInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects empty brandName', () => {
    const inputs = {
      brandConfig: {
        brandName: '',
        productDomain: 'SaaS',
      },
    }
    const result = audienceResearchInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})
