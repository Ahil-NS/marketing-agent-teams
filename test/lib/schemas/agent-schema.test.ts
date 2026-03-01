import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {describe, it, expect} from 'vitest'

import {agentDefinitionSchema, trendBriefSchema, competitorReportSchema, researchInputsSchema, viralPatternReportSchema, platformAlgorithmReportSchema} from '../../../src/lib/schemas/agent-schema.js'

describe('agentDefinitionSchema', () => {
  it('validates a complete agent definition', () => {
    const valid = {
      name: 'trend-scout',
      description: 'Researches trends',
      cluster: 'intelligence',
      model: 'haiku',
      tools: ['WebSearch', 'WebFetch'],
      trustTier: 'builtin',
    }
    const result = agentDefinitionSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('trend-scout')
      expect(result.data.cluster).toBe('intelligence')
    }
  })

  it('applies defaults for model, tools, and trustTier', () => {
    const minimal = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'creation',
    }
    const result = agentDefinitionSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.model).toBe('haiku')
      expect(result.data.tools).toEqual([])
      expect(result.data.trustTier).toBe('builtin')
    }
  })

  it('rejects empty name', () => {
    const invalid = {
      name: '',
      description: 'test',
      cluster: 'intelligence',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty description', () => {
    const invalid = {
      name: 'test',
      description: '',
      cluster: 'intelligence',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid cluster', () => {
    const invalid = {
      name: 'test',
      description: 'test',
      cluster: 'nonexistent',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts all valid cluster values', () => {
    const clusters = ['intelligence', 'strategy', 'creation', 'optimization', 'quality', 'distribution', 'coordination']
    for (const cluster of clusters) {
      const result = agentDefinitionSchema.safeParse({
        name: 'test',
        description: 'test',
        cluster,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid model', () => {
    const invalid = {
      name: 'test',
      description: 'test',
      cluster: 'intelligence',
      model: 'opus',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid trustTier', () => {
    const invalid = {
      name: 'test',
      description: 'test',
      cluster: 'intelligence',
      trustTier: 'admin',
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts optional examples field with valid entries', () => {
    const withExamples = {
      name: 'trend-scout',
      description: 'Researches trends',
      cluster: 'intelligence',
      examples: [
        {
          description: 'SaaS product trend research',
          inputs: {brandName: 'TestBrand', productDomain: 'SaaS'},
        },
      ],
    }
    const result = agentDefinitionSchema.safeParse(withExamples)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.examples).toHaveLength(1)
      expect(result.data.examples![0].description).toBe('SaaS product trend research')
      expect(result.data.examples![0].inputs).toEqual({brandName: 'TestBrand', productDomain: 'SaaS'})
    }
  })

  it('accepts agent definition without examples field', () => {
    const withoutExamples = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'creation',
    }
    const result = agentDefinitionSchema.safeParse(withoutExamples)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.examples).toBeUndefined()
    }
  })

  it('rejects examples with empty description', () => {
    const invalid = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      examples: [
        {description: '', inputs: {key: 'value'}},
      ],
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('applies default permissions when not provided', () => {
    const minimal = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'creation',
    }
    const result = agentDefinitionSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual({
        credentials: [],
        dataScopes: [],
        toolScopes: [],
      })
    }
  })

  it('accepts full permissions object', () => {
    const withPermissions = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      tools: ['WebSearch', 'WebFetch'],
      permissions: {
        credentials: ['reddit-oauth'],
        dataScopes: ['brand-config', 'pipeline-state'],
        toolScopes: ['WebSearch', 'WebFetch'],
      },
    }
    const result = agentDefinitionSchema.safeParse(withPermissions)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions.credentials).toEqual(['reddit-oauth'])
      expect(result.data.permissions.dataScopes).toContain('brand-config')
      expect(result.data.permissions.toolScopes).toHaveLength(2)
    }
  })

  it('applies defaults for partial permissions object', () => {
    const partial = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {
        credentials: ['my-key'],
      },
    }
    const result = agentDefinitionSchema.safeParse(partial)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions.credentials).toEqual(['my-key'])
      expect(result.data.permissions.dataScopes).toEqual([])
      expect(result.data.permissions.toolScopes).toEqual([])
    }
  })

  it('accepts empty permissions object', () => {
    const empty = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {},
    }
    const result = agentDefinitionSchema.safeParse(empty)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual({
        credentials: [],
        dataScopes: [],
        toolScopes: [],
      })
    }
  })

  it('rejects permissions.credentials as non-array', () => {
    const invalid = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      permissions: {
        credentials: 'not-an-array',
      },
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects toolScopes that reference tools not in tools array', () => {
    const invalid = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      tools: ['WebSearch'],
      permissions: {
        toolScopes: ['WebSearch', 'Read'],
      },
    }
    const result = agentDefinitionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts toolScopes that are a subset of tools', () => {
    const valid = {
      name: 'test-agent',
      description: 'A test agent',
      cluster: 'intelligence',
      tools: ['WebSearch', 'Read', 'Bash'],
      permissions: {
        toolScopes: ['WebSearch', 'Read'],
      },
    }
    const result = agentDefinitionSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})

describe('trendBriefSchema', () => {
  const validBrief = {
    trends: [
      {
        name: 'Test Trend',
        platform: 'tiktok',
        description: 'A trending topic',
        engagementMetrics: {
          source: 'TikTok Creative Center',
          recency: '2026-02-28',
          volume: 100000,
        },
        trajectory: 'emerging' as const,
        relevanceScore: 4,
      },
    ],
    viralPatterns: [
      {
        pattern: 'Hook pattern',
        platforms: ['tiktok', 'instagram'],
        format: 'short-form video',
        examples: ['Example 1'],
      },
    ],
    opportunities: [
      {
        description: 'Marketing opportunity',
        relevanceScore: 5,
        timelinessScore: 4,
        platforms: ['reddit', 'tiktok'],
        suggestedAngle: 'Behind-the-scenes content format',
      },
    ],
    risks: [
      {
        description: 'Trend may peak soon',
        severity: 'medium' as const,
        mitigation: 'Publish within 5 days',
      },
    ],
    recommendations: 'Focus on short-form video content.',
  }

  it('validates a complete trend brief', () => {
    const result = trendBriefSchema.safeParse(validBrief)
    expect(result.success).toBe(true)
  })

  it('accepts brief without optional volume field', () => {
    const brief = {
      ...validBrief,
      trends: [{
        name: 'No Volume',
        platform: 'reddit',
        description: 'test',
        engagementMetrics: {source: 'Reddit', recency: '2026-02-28'},
        trajectory: 'peaking' as const,
        relevanceScore: 3,
      }],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(true)
  })

  it('accepts brief without optional examples field', () => {
    const brief = {
      ...validBrief,
      viralPatterns: [{pattern: 'test', platforms: ['reddit'], format: 'text post'}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(true)
  })

  it('rejects relevanceScore below 1', () => {
    const brief = {
      ...validBrief,
      trends: [{
        name: 'test',
        platform: 'tiktok',
        description: 'test',
        engagementMetrics: {source: 'test', recency: 'today'},
        trajectory: 'emerging' as const,
        relevanceScore: 0,
      }],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('rejects relevanceScore above 5', () => {
    const brief = {
      ...validBrief,
      trends: [{
        name: 'test',
        platform: 'tiktok',
        description: 'test',
        engagementMetrics: {source: 'test', recency: 'today'},
        trajectory: 'emerging' as const,
        relevanceScore: 6,
      }],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('rejects invalid trajectory', () => {
    const brief = {
      ...validBrief,
      trends: [{
        name: 'test',
        platform: 'tiktok',
        description: 'test',
        engagementMetrics: {source: 'test', recency: 'today'},
        trajectory: 'growing',
        relevanceScore: 3,
      }],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('rejects invalid risk severity', () => {
    const brief = {
      ...validBrief,
      risks: [{description: 'test', severity: 'critical', mitigation: 'test'}],
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(false)
  })

  it('accepts empty arrays', () => {
    const brief = {
      trends: [],
      viralPatterns: [],
      opportunities: [],
      risks: [],
      recommendations: '',
    }
    const result = trendBriefSchema.safeParse(brief)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(trendBriefSchema.safeParse({}).success).toBe(false)
    expect(trendBriefSchema.safeParse({trends: []}).success).toBe(false)
    expect(trendBriefSchema.safeParse({trends: [], viralPatterns: []}).success).toBe(false)
    expect(trendBriefSchema.safeParse({trends: [], viralPatterns: [], opportunities: []}).success).toBe(false)
    expect(trendBriefSchema.safeParse({trends: [], viralPatterns: [], opportunities: [], risks: []}).success).toBe(false)
  })
})

describe('competitorReportSchema', () => {
  const validReport = {
    competitors: [
      {
        name: 'CompetitorCo',
        platforms: [
          {
            platform: 'tiktok',
            handle: '@competitorco',
            followerCount: 50000,
            postingFrequency: '3 times/week',
            engagementRate: '4.5%',
            contentTypes: ['tutorials', 'product demos'],
          },
        ],
      },
    ],
    contentAnalysis: [
      {
        competitor: 'CompetitorCo',
        topPerformingContent: [
          {
            platform: 'tiktok',
            description: 'Product comparison video',
            engagementSignals: '50K views, 5K likes',
            format: 'short-form video',
          },
        ],
      },
    ],
    viralContent: [
      {
        competitor: 'CompetitorCo',
        platform: 'tiktok',
        description: 'Behind-the-scenes video',
        whyViral: 'Authentic tone with trending sound',
        replicabilityScore: 4,
      },
    ],
    gaps: [
      {
        area: 'Reddit presence',
        description: 'No Reddit strategy despite active audience',
        opportunity: 'Establish community presence via AMA',
      },
    ],
    recommendations: 'Target Reddit as uncontested channel.',
  }

  it('validates a complete competitor report', () => {
    const result = competitorReportSchema.safeParse(validReport)
    expect(result.success).toBe(true)
  })

  it('accepts platforms without optional handle and followerCount', () => {
    const report = {
      ...validReport,
      competitors: [{
        name: 'Test',
        platforms: [{
          platform: 'reddit',
          postingFrequency: 'daily',
          engagementRate: '2%',
          contentTypes: ['text posts'],
        }],
      }],
    }
    const result = competitorReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects replicabilityScore below 1', () => {
    const report = {
      ...validReport,
      viralContent: [{
        competitor: 'Test',
        platform: 'tiktok',
        description: 'test',
        whyViral: 'test',
        replicabilityScore: 0,
      }],
    }
    const result = competitorReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects replicabilityScore above 5', () => {
    const report = {
      ...validReport,
      viralContent: [{
        competitor: 'Test',
        platform: 'tiktok',
        description: 'test',
        whyViral: 'test',
        replicabilityScore: 6,
      }],
    }
    const result = competitorReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('accepts empty arrays', () => {
    const report = {
      competitors: [],
      contentAnalysis: [],
      viralContent: [],
      gaps: [],
      recommendations: '',
    }
    const result = competitorReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(competitorReportSchema.safeParse({}).success).toBe(false)
    expect(competitorReportSchema.safeParse({competitors: []}).success).toBe(false)
    expect(competitorReportSchema.safeParse({competitors: [], contentAnalysis: []}).success).toBe(false)
    expect(competitorReportSchema.safeParse({competitors: [], contentAnalysis: [], viralContent: []}).success).toBe(false)
    expect(competitorReportSchema.safeParse({competitors: [], contentAnalysis: [], viralContent: [], gaps: []}).success).toBe(false)
  })
})

describe('researchInputsSchema', () => {
  it('validates correct inputs', () => {
    const valid = {
      brandName: 'TestBrand',
      productDomain: 'SaaS',
      audienceType: 'developers',
      platforms: ['reddit', 'tiktok'],
    }
    const result = researchInputsSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts optional trendTimeframeDays', () => {
    const valid = {
      brandName: 'TestBrand',
      productDomain: 'SaaS',
      audienceType: 'developers',
      platforms: ['reddit'],
      trendTimeframeDays: 14,
    }
    const result = researchInputsSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.trendTimeframeDays).toBe(14)
    }
  })

  it('rejects empty brandName', () => {
    const invalid = {
      brandName: '',
      productDomain: 'SaaS',
      audienceType: 'developers',
      platforms: ['reddit'],
    }
    const result = researchInputsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty platforms array', () => {
    const invalid = {
      brandName: 'Test',
      productDomain: 'SaaS',
      audienceType: 'developers',
      platforms: [],
    }
    const result = researchInputsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(researchInputsSchema.safeParse({}).success).toBe(false)
    expect(researchInputsSchema.safeParse({brandName: 'test'}).success).toBe(false)
  })

  it('rejects negative trendTimeframeDays', () => {
    const invalid = {
      brandName: 'Test',
      productDomain: 'SaaS',
      audienceType: 'developers',
      platforms: ['reddit'],
      trendTimeframeDays: -5,
    }
    const result = researchInputsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects non-integer trendTimeframeDays', () => {
    const invalid = {
      brandName: 'Test',
      productDomain: 'SaaS',
      audienceType: 'developers',
      platforms: ['reddit'],
      trendTimeframeDays: 14.5,
    }
    const result = researchInputsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('fixture validation', () => {
  const fixturesDir = join(import.meta.dirname, '../../fixtures/responses')

  it('claude-trend-brief.json fixture validates against trendBriefSchema', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'claude-trend-brief.json'), 'utf-8'))
    const result = trendBriefSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('claude-competitor-report.json fixture validates against competitorReportSchema', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'claude-competitor-report.json'), 'utf-8'))
    const result = competitorReportSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('claude-viral-pattern-report.json fixture validates against viralPatternReportSchema', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'claude-viral-pattern-report.json'), 'utf-8'))
    const result = viralPatternReportSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('claude-algorithm-report.json fixture validates against platformAlgorithmReportSchema', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'claude-algorithm-report.json'), 'utf-8'))
    const result = platformAlgorithmReportSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })
})

describe('viralPatternReportSchema', () => {
  const validReport = {
    viralPatterns: [
      {
        platform: 'tiktok',
        pattern: 'Hook-in-first-second',
        description: 'Videos with immediate visual hook',
        frequency: 'common' as const,
        examples: ['Example 1'],
        replicabilityScore: 4,
      },
    ],
    hookAnalysis: [
      {
        hookType: 'Curiosity Gap',
        platform: 'tiktok',
        description: 'Creates information gap',
        effectiveness: 'very-high' as const,
        examples: ['Wait for it...'],
      },
    ],
    captionStyles: [
      {
        platform: 'instagram',
        style: 'Micro-storytelling',
        description: 'Short personal anecdotes',
        languagePatterns: ['First person', 'Emotional opener'],
        engagementImpact: 'High save rate',
      },
    ],
    hashtagStrategies: [
      {
        platform: 'instagram',
        strategy: '3-5-2 Stack',
        recommendedCount: 10,
        hashtagTypes: ['broad', 'niche', 'branded'],
        examples: ['#marketing #saas'],
      },
    ],
    timingInsights: [
      {
        platform: 'tiktok',
        bestDays: ['Tuesday', 'Thursday'],
        bestHours: ['7:00 AM - 9:00 AM'],
        timezone: 'US Eastern (ET)',
        rationale: 'Morning scroll window',
      },
    ],
    recommendations: 'Focus on short-form video.',
  }

  it('validates a complete viral pattern report', () => {
    const result = viralPatternReportSchema.safeParse(validReport)
    expect(result.success).toBe(true)
  })

  it('accepts report without optional examples', () => {
    const report = {
      ...validReport,
      viralPatterns: [{
        platform: 'reddit',
        pattern: 'Data post',
        description: 'Original data analysis',
        frequency: 'occasional' as const,
        replicabilityScore: 3,
      }],
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects invalid frequency value', () => {
    const report = {
      ...validReport,
      viralPatterns: [{
        platform: 'tiktok',
        pattern: 'test',
        description: 'test',
        frequency: 'always',
        replicabilityScore: 3,
      }],
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects invalid effectiveness value', () => {
    const report = {
      ...validReport,
      hookAnalysis: [{
        hookType: 'test',
        platform: 'tiktok',
        description: 'test',
        effectiveness: 'super-high',
      }],
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects replicabilityScore below 1', () => {
    const report = {
      ...validReport,
      viralPatterns: [{
        platform: 'tiktok',
        pattern: 'test',
        description: 'test',
        frequency: 'common' as const,
        replicabilityScore: 0,
      }],
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects replicabilityScore above 5', () => {
    const report = {
      ...validReport,
      viralPatterns: [{
        platform: 'tiktok',
        pattern: 'test',
        description: 'test',
        frequency: 'common' as const,
        replicabilityScore: 6,
      }],
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects empty critical arrays (viralPatterns, hookAnalysis)', () => {
    const report = {
      viralPatterns: [],
      hookAnalysis: [],
      captionStyles: [],
      hashtagStrategies: [],
      timingInsights: [],
      recommendations: '',
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('accepts empty optional arrays when critical arrays are populated', () => {
    const report = {
      viralPatterns: [{
        platform: 'tiktok',
        pattern: 'test',
        description: 'test',
        frequency: 'common' as const,
        replicabilityScore: 3,
      }],
      hookAnalysis: [{
        hookType: 'test',
        platform: 'tiktok',
        description: 'test',
        effectiveness: 'high' as const,
      }],
      captionStyles: [],
      hashtagStrategies: [],
      timingInsights: [],
      recommendations: '',
    }
    const result = viralPatternReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(viralPatternReportSchema.safeParse({}).success).toBe(false)
    expect(viralPatternReportSchema.safeParse({viralPatterns: []}).success).toBe(false)
    expect(viralPatternReportSchema.safeParse({viralPatterns: [], hookAnalysis: []}).success).toBe(false)
    expect(viralPatternReportSchema.safeParse({viralPatterns: [], hookAnalysis: [], captionStyles: []}).success).toBe(false)
    expect(viralPatternReportSchema.safeParse({viralPatterns: [], hookAnalysis: [], captionStyles: [], hashtagStrategies: []}).success).toBe(false)
    expect(viralPatternReportSchema.safeParse({viralPatterns: [], hookAnalysis: [], captionStyles: [], hashtagStrategies: [], timingInsights: []}).success).toBe(false)
  })
})

describe('platformAlgorithmReportSchema', () => {
  const validReport = {
    platforms: [
      {
        name: 'tiktok',
        lastUpdated: '2026-02-28',
        overallStrategy: 'Focus on completion rate.',
      },
    ],
    algorithmPriorities: [
      {
        platform: 'tiktok',
        priority: 'Completion rate',
        weight: 'critical' as const,
        description: 'Videos watched to completion get more distribution.',
        recentChanges: 'Longer videos now viable.',
      },
    ],
    rankingSignals: [
      {
        platform: 'tiktok',
        signal: 'Completion rate',
        impact: 'strong-positive' as const,
        description: 'Most important metric for FYP distribution.',
        actionable: true,
      },
    ],
    optimizationStrategies: [
      {
        platform: 'tiktok',
        strategy: 'Front-load the hook',
        description: 'Immediate visual impact in first 0.5s.',
        expectedImpact: 'high' as const,
        implementation: 'Open with bold text overlay.',
        antiPatterns: ['Logo animations', 'Slow pans'],
      },
    ],
    recommendations: 'Prioritize completion rate optimization.',
  }

  it('validates a complete platform algorithm report', () => {
    const result = platformAlgorithmReportSchema.safeParse(validReport)
    expect(result.success).toBe(true)
  })

  it('accepts report without optional fields', () => {
    const report = {
      ...validReport,
      algorithmPriorities: [{
        platform: 'reddit',
        priority: 'Upvote velocity',
        weight: 'high' as const,
        description: 'Early upvotes matter most.',
      }],
      optimizationStrategies: [{
        platform: 'reddit',
        strategy: 'Post at 6-8 AM ET',
        description: 'Maximize engagement runway.',
        expectedImpact: 'high' as const,
        implementation: 'Schedule posts early morning.',
      }],
    }
    const result = platformAlgorithmReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects invalid weight value', () => {
    const report = {
      ...validReport,
      algorithmPriorities: [{
        platform: 'tiktok',
        priority: 'test',
        weight: 'extreme',
        description: 'test',
      }],
    }
    const result = platformAlgorithmReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects invalid impact value', () => {
    const report = {
      ...validReport,
      rankingSignals: [{
        platform: 'tiktok',
        signal: 'test',
        impact: 'very-positive',
        description: 'test',
        actionable: true,
      }],
    }
    const result = platformAlgorithmReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects invalid expectedImpact value', () => {
    const report = {
      ...validReport,
      optimizationStrategies: [{
        platform: 'tiktok',
        strategy: 'test',
        description: 'test',
        expectedImpact: 'extreme',
        implementation: 'test',
      }],
    }
    const result = platformAlgorithmReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('rejects empty critical arrays (algorithmPriorities, rankingSignals, optimizationStrategies)', () => {
    const report = {
      platforms: [],
      algorithmPriorities: [],
      rankingSignals: [],
      optimizationStrategies: [],
      recommendations: '',
    }
    const result = platformAlgorithmReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('accepts empty platforms array when critical arrays are populated', () => {
    const report = {
      platforms: [],
      algorithmPriorities: [{
        platform: 'tiktok',
        priority: 'Completion rate',
        weight: 'high' as const,
        description: 'test',
      }],
      rankingSignals: [{
        platform: 'tiktok',
        signal: 'Completion rate',
        impact: 'positive' as const,
        description: 'test',
        actionable: true,
      }],
      optimizationStrategies: [{
        platform: 'tiktok',
        strategy: 'Front-load hook',
        description: 'test',
        expectedImpact: 'high' as const,
        implementation: 'test',
      }],
      recommendations: '',
    }
    const result = platformAlgorithmReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(platformAlgorithmReportSchema.safeParse({}).success).toBe(false)
    expect(platformAlgorithmReportSchema.safeParse({platforms: []}).success).toBe(false)
    expect(platformAlgorithmReportSchema.safeParse({platforms: [], algorithmPriorities: []}).success).toBe(false)
    expect(platformAlgorithmReportSchema.safeParse({platforms: [], algorithmPriorities: [], rankingSignals: []}).success).toBe(false)
    expect(platformAlgorithmReportSchema.safeParse({platforms: [], algorithmPriorities: [], rankingSignals: [], optimizationStrategies: []}).success).toBe(false)
  })
})

describe('verticalDefinitionSchema', () => {
  let verticalDefinitionSchema: typeof import('../../../src/lib/schemas/agent-schema.js').verticalDefinitionSchema

  it('loads verticalDefinitionSchema', async () => {
    const mod = await import('../../../src/lib/schemas/agent-schema.js')
    verticalDefinitionSchema = mod.verticalDefinitionSchema
    expect(verticalDefinitionSchema).toBeDefined()
  })

  it('validates a complete vertical definition', async () => {
    const mod = await import('../../../src/lib/schemas/agent-schema.js')
    const validDef = {
      name: 'wellness',
      description: 'Wellness vertical module',
      version: '1.0.0',
      complianceRules: ['No medical claims', 'Use approved language'],
      knowledgeFiles: ['knowledge/hooks.md', 'knowledge/compliance.md'],
    }
    const result = mod.verticalDefinitionSchema.safeParse(validDef)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('wellness')
      expect(result.data.complianceRules).toHaveLength(2)
      expect(result.data.knowledgeFiles).toHaveLength(2)
    }
  })

  it('requires name, description, and version', async () => {
    const mod = await import('../../../src/lib/schemas/agent-schema.js')
    expect(mod.verticalDefinitionSchema.safeParse({}).success).toBe(false)
    expect(mod.verticalDefinitionSchema.safeParse({name: 'wellness'}).success).toBe(false)
    expect(mod.verticalDefinitionSchema.safeParse({name: 'wellness', description: 'test'}).success).toBe(false)
  })

  it('defaults complianceRules and knowledgeFiles to empty arrays', async () => {
    const mod = await import('../../../src/lib/schemas/agent-schema.js')
    const minimalDef = {
      name: 'minimal',
      description: 'A minimal vertical',
      version: '0.1.0',
    }
    const result = mod.verticalDefinitionSchema.safeParse(minimalDef)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.complianceRules).toEqual([])
      expect(result.data.knowledgeFiles).toEqual([])
    }
  })

  it('is re-exported from schemas/index.ts', async () => {
    const mod = await import('../../../src/lib/schemas/index.js')
    expect(mod.verticalDefinitionSchema).toBeDefined()
  })
})
