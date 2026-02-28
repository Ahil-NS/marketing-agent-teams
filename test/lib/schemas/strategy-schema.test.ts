import {describe, it, expect} from 'vitest'

import {
  campaignPlanSchema,
  contentCalendarSchema,
  channelOptimizationPlanSchema,
  strategyInputsSchema,
  calendarInputsSchema,
  optimizerInputsSchema,
} from '../../../src/lib/schemas/strategy-schema.js'

import validCampaignPlan from '../../fixtures/responses/claude-campaign-plan.json'
import validContentCalendar from '../../fixtures/responses/claude-content-calendar.json'
import validChannelOptimization from '../../fixtures/responses/claude-channel-optimization.json'

describe('campaignPlanSchema', () => {
  it('validates correct structure', () => {
    const result = campaignPlanSchema.safeParse(validCampaignPlan)
    expect(result.success).toBe(true)
  })

  it('rejects missing required field planId', () => {
    const {planId: _, ...plan} = validCampaignPlan
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects missing required field campaignName', () => {
    const {campaignName: _, ...plan} = validCampaignPlan
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects missing required field contentThemes', () => {
    const {contentThemes: _, ...plan} = validCampaignPlan
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects campaignName shorter than 3 characters', () => {
    const plan = {...validCampaignPlan, campaignName: 'ab'}
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects contentThemes with more than 7 items', () => {
    const themes = Array.from({length: 8}, (_, i) => ({
      theme: `Theme ${i}`,
      rationale: 'test rationale',
      contentTypes: ['educational'],
      platformFit: {tiktok: 0.5},
    }))
    const plan = {...validCampaignPlan, contentThemes: themes}
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 content theme', () => {
    const plan = {...validCampaignPlan, contentThemes: []}
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects negative budget estimatedCost', () => {
    const plan = {...validCampaignPlan, budget: {...validCampaignPlan.budget, estimatedCost: -100}}
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('requires at least 1 success metric', () => {
    const plan = {...validCampaignPlan, successMetrics: []}
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects success metric with non-positive target', () => {
    const plan = {
      ...validCampaignPlan,
      successMetrics: [{metric: 'test', target: 0}],
    }
    const result = campaignPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })
})

describe('contentCalendarSchema', () => {
  it('validates correct structure', () => {
    const result = contentCalendarSchema.safeParse(validContentCalendar)
    expect(result.success).toBe(true)
  })

  it('rejects missing required field entries', () => {
    const {entries: _, ...calendar} = validContentCalendar
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })

  it('rejects missing required field platformBalance', () => {
    const {platformBalance: _, ...calendar} = validContentCalendar
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })

  it('rejects empty entries array', () => {
    const calendar = {...validContentCalendar, entries: []}
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })

  it('rejects invalid platform in entry', () => {
    const calendar = {
      ...validContentCalendar,
      entries: [{...validContentCalendar.entries[0], platform: 'twitter'}],
    }
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })

  it('rejects invalid contentType in entry', () => {
    const calendar = {
      ...validContentCalendar,
      entries: [{...validContentCalendar.entries[0], contentType: 'spam'}],
    }
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })

  it('rejects engagement rate above 1.0', () => {
    const calendar = {
      ...validContentCalendar,
      entries: [{
        ...validContentCalendar.entries[0],
        estimatedEngagement: {reach: 1000, engagementRate: 1.5},
      }],
    }
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })

  it('validates platformBalance values are between 0 and 1', () => {
    const result = contentCalendarSchema.safeParse(validContentCalendar)
    expect(result.success).toBe(true)
    if (result.success) {
      for (const value of Object.values(result.data.platformBalance)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('platformBalance values sum to approximately 1.0', () => {
    const result = contentCalendarSchema.safeParse(validContentCalendar)
    expect(result.success).toBe(true)
    if (result.success) {
      const sum = Object.values(result.data.platformBalance).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 1) // within 0.05
    }
  })

  it('rejects invalid period duration', () => {
    const calendar = {
      ...validContentCalendar,
      period: {...validContentCalendar.period, duration: 'biweekly'},
    }
    const result = contentCalendarSchema.safeParse(calendar)
    expect(result.success).toBe(false)
  })
})

describe('channelOptimizationPlanSchema', () => {
  it('validates correct structure', () => {
    const result = channelOptimizationPlanSchema.safeParse(validChannelOptimization)
    expect(result.success).toBe(true)
  })

  it('rejects missing perPlatformRecommendations', () => {
    const {perPlatformRecommendations: _, ...plan} = validChannelOptimization
    const result = channelOptimizationPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects empty perPlatformRecommendations', () => {
    const plan = {...validChannelOptimization, perPlatformRecommendations: []}
    const result = channelOptimizationPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects invalid algorithm boost value', () => {
    const plan = {
      ...validChannelOptimization,
      perPlatformRecommendations: [{
        ...validChannelOptimization.perPlatformRecommendations[0],
        contentFormatPreferences: [{
          format: 'test',
          algorithmBoost: 'invalid' as const,
          recommendation: 'test',
        }],
      }],
    }
    const result = channelOptimizationPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects invalid estimated impact in cross-platform strategies', () => {
    const plan = {
      ...validChannelOptimization,
      crossPlatformStrategies: [{
        strategy: 'test',
        description: 'test',
        platforms: ['tiktok'],
        expectedImpact: 'critical' as const,
      }],
    }
    const result = channelOptimizationPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })
})

describe('strategyInputsSchema', () => {
  const validStrategyInputs = {
    trendBrief: {
      trends: [{
        name: 'Short-form video',
        platform: 'tiktok',
        description: 'Trending format',
        engagementMetrics: {source: 'TikTok Analytics', recency: '2026-02-28'},
        trajectory: 'emerging',
        relevanceScore: 4,
      }],
      viralPatterns: [{
        pattern: 'Hook-in-3-seconds',
        platforms: ['tiktok'],
        format: 'short-form-video',
      }],
      opportunities: [{
        description: 'Early mover on wellness TikTok',
        relevanceScore: 4,
        timelinessScore: 5,
        platforms: ['tiktok'],
        suggestedAngle: 'Morning routine tips',
      }],
      risks: [{
        description: 'Trend saturation',
        severity: 'medium',
        mitigation: 'Differentiate through authority',
      }],
      recommendations: 'Focus on short-form',
    },
    competitorReport: {
      competitors: [{
        name: 'CompetitorCo',
        platforms: [{platform: 'reddit', postingFrequency: '3/week', engagementRate: '2.5%', contentTypes: ['educational']}],
      }],
      contentAnalysis: [{
        competitor: 'CompetitorCo',
        topPerformingContent: [{platform: 'reddit', description: 'AMA post', engagementSignals: '500 upvotes', format: 'text-post'}],
      }],
      viralContent: [{
        competitor: 'CompetitorCo',
        platform: 'tiktok',
        description: 'Routine video',
        whyViral: 'Trending',
        replicabilityScore: 3,
      }],
      gaps: [{area: 'Reddit', description: 'No competitor on Reddit', opportunity: 'Build authority'}],
      recommendations: 'Target Reddit',
    },
    viralPatternReport: {
      viralPatterns: [{platform: 'tiktok', pattern: 'Hook-in-3-seconds', description: 'Strong hooks', frequency: 'common', replicabilityScore: 4}],
      hookAnalysis: [{hookType: 'question-hook', platform: 'tiktok', description: 'Provocative question', effectiveness: 'high'}],
      captionStyles: [{platform: 'tiktok', style: 'conversational', description: 'Casual captions', languagePatterns: ['you'], engagementImpact: '+35%'}],
      hashtagStrategies: [{platform: 'tiktok', strategy: 'Mix broad and niche', recommendedCount: 5, hashtagTypes: ['trending']}],
      timingInsights: [{platform: 'tiktok', bestDays: ['Tuesday'], bestHours: ['07:00'], timezone: 'EST', rationale: 'Peak hours'}],
      recommendations: 'Use hook patterns',
    },
    platformAlgorithmReport: {
      platforms: [{name: 'tiktok', lastUpdated: '2026-03-01', overallStrategy: 'Engagement-first'}],
      algorithmPriorities: [{platform: 'tiktok', priority: 'Watch time', weight: 'critical', description: 'Completion rate matters'}],
      rankingSignals: [{platform: 'tiktok', signal: 'Completion rate', impact: 'strong-positive', description: 'Higher completion = wider distribution', actionable: true}],
      optimizationStrategies: [{platform: 'tiktok', strategy: 'Hook-first', description: 'Front-load hook', expectedImpact: 'high', implementation: 'Start with question'}],
      recommendations: 'Prioritize engagement signals',
    },
    brandVoiceConfig: {
      tone: 'professional',
      communicationStyle: 'clear',
      brandPrinciples: ['honesty'],
      bannedPhrases: ['spam'],
    },
    platforms: ['tiktok'] as ('reddit' | 'tiktok' | 'facebook' | 'instagram')[],
  }

  it('validates correct inputs', () => {
    const result = strategyInputsSchema.safeParse(validStrategyInputs)
    expect(result.success).toBe(true)
  })

  it('rejects empty platforms array', () => {
    const inputs = {...validStrategyInputs, platforms: []}
    const result = strategyInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects invalid platform name', () => {
    const inputs = {...validStrategyInputs, platforms: ['twitter']}
    const result = strategyInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects missing brandVoiceConfig', () => {
    const {brandVoiceConfig: _, ...inputs} = validStrategyInputs
    const result = strategyInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects invalid trendBrief (missing required fields)', () => {
    const inputs = {...validStrategyInputs, trendBrief: {trends: []}}
    const result = strategyInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})

describe('calendarInputsSchema', () => {
  it('validates correct inputs', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear and direct',
      },
      calendarDuration: '14-day',
    }
    const result = calendarInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('validates without optional calendarDuration', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
      },
    }
    const result = calendarInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('rejects invalid calendarDuration value', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
      },
      calendarDuration: 'biweekly',
    }
    const result = calendarInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects missing campaignPlan', () => {
    const inputs = {
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
      },
    }
    const result = calendarInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects invalid campaignPlan structure', () => {
    const inputs = {
      campaignPlan: {planId: 'x'},
      brandVoiceConfig: {
        tone: 'professional',
        communicationStyle: 'clear',
      },
    }
    const result = calendarInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})

describe('optimizerInputsSchema', () => {
  it('validates correct inputs', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      contentCalendar: validContentCalendar,
      platformAlgorithmReport: {
        platforms: [{name: 'tiktok', lastUpdated: '2026-03-01', overallStrategy: 'Engagement-first'}],
        algorithmPriorities: [{platform: 'tiktok', priority: 'Watch time', weight: 'critical', description: 'Completion rate matters'}],
        rankingSignals: [{platform: 'tiktok', signal: 'Completion rate', impact: 'strong-positive', description: 'Higher completion = wider distribution', actionable: true}],
        optimizationStrategies: [{platform: 'tiktok', strategy: 'Hook-first', description: 'Front-load hook', expectedImpact: 'high', implementation: 'Start with question'}],
        recommendations: 'Prioritize engagement signals',
      },
    }
    const result = optimizerInputsSchema.safeParse(inputs)
    expect(result.success).toBe(true)
  })

  it('rejects missing contentCalendar', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      platformAlgorithmReport: {
        platforms: [{name: 'tiktok', lastUpdated: '2026-03-01', overallStrategy: 'Engagement-first'}],
        algorithmPriorities: [{platform: 'tiktok', priority: 'Watch time', weight: 'critical', description: 'Completion matters'}],
        rankingSignals: [{platform: 'tiktok', signal: 'Completion rate', impact: 'strong-positive', description: 'Description', actionable: true}],
        optimizationStrategies: [{platform: 'tiktok', strategy: 'Hook-first', description: 'Front-load', expectedImpact: 'high', implementation: 'Question'}],
        recommendations: 'Prioritize',
      },
    }
    const result = optimizerInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects missing platformAlgorithmReport', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      contentCalendar: validContentCalendar,
    }
    const result = optimizerInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })

  it('rejects invalid platformAlgorithmReport (missing required arrays)', () => {
    const inputs = {
      campaignPlan: validCampaignPlan,
      contentCalendar: validContentCalendar,
      platformAlgorithmReport: {platforms: [], recommendations: 'test'},
    }
    const result = optimizerInputsSchema.safeParse(inputs)
    expect(result.success).toBe(false)
  })
})
