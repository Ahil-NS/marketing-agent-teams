import {describe, it, expect} from 'vitest'

import {formatHashtagsForPlatform, selectTopHashtags} from '../../../src/lib/agents/hashtag-formatter.js'
import type {HashtagRecommendation} from '../../../src/lib/schemas/hashtag-schema.js'

// --- Test data ---

const sampleHashtags: HashtagRecommendation[] = [
  {tag: 'wellness', reachEstimate: 'high', relevanceScore: 92, competitionLevel: 'high', category: 'evergreen'},
  {tag: 'meditation', reachEstimate: 'high', relevanceScore: 88, competitionLevel: 'medium', category: 'niche'},
  {tag: 'selfcare', reachEstimate: 'medium', relevanceScore: 78, competitionLevel: 'medium', category: 'trending'},
  {tag: 'mindfulness', reachEstimate: 'medium', relevanceScore: 85, competitionLevel: 'medium', category: 'community'},
  {tag: 'brandzen', reachEstimate: 'low', relevanceScore: 95, competitionLevel: 'low', category: 'branded'},
]

describe('formatHashtagsForPlatform', () => {
  it('formats TikTok hashtags with # prefix and spaces', () => {
    const result = formatHashtagsForPlatform(sampleHashtags.slice(0, 3), 'tiktok')
    expect(result).toBe('#wellness #meditation #selfcare')
  })

  it('formats Instagram hashtags with # prefix and spaces', () => {
    const result = formatHashtagsForPlatform(sampleHashtags.slice(0, 2), 'instagram')
    expect(result).toBe('#wellness #meditation')
  })

  it('formats Facebook hashtags with # prefix and spaces', () => {
    const result = formatHashtagsForPlatform(sampleHashtags.slice(0, 1), 'facebook')
    expect(result).toBe('#wellness')
  })

  it('returns empty string for Reddit', () => {
    const result = formatHashtagsForPlatform(sampleHashtags, 'reddit')
    expect(result).toBe('')
  })

  it('returns empty string for empty hashtag array', () => {
    const result = formatHashtagsForPlatform([], 'instagram')
    expect(result).toBe('')
  })
})

describe('selectTopHashtags', () => {
  it('returns top N by relevance score', () => {
    const result = selectTopHashtags(sampleHashtags, 3)
    expect(result).toHaveLength(3)
    // Should be sorted by relevance descending: brandzen(95), wellness(92), meditation(88)
    // But mix requirement may reorder — check top relevance scores are included
    const scores = result.map((h) => h.relevanceScore)
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1])
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2])
  })

  it('ensures mix of trending + niche when limit >= 3', () => {
    const result = selectTopHashtags(sampleHashtags, 3)
    const categories = result.map((h) => h.category)
    // Should include at least one trending and one niche
    expect(categories).toContain('trending')
    expect(categories).toContain('niche')
  })

  it('handles case where fewer hashtags than limit', () => {
    const fewTags = sampleHashtags.slice(0, 2)
    const result = selectTopHashtags(fewTags, 5)
    expect(result).toHaveLength(2)
    // Should still be sorted by relevance
    expect(result[0].relevanceScore).toBeGreaterThanOrEqual(result[1].relevanceScore)
  })

  it('returns all hashtags when exactly at limit', () => {
    const result = selectTopHashtags(sampleHashtags, 5)
    expect(result).toHaveLength(5)
  })

  it('respects limit of 1 (no mix requirement)', () => {
    const result = selectTopHashtags(sampleHashtags, 1)
    expect(result).toHaveLength(1)
    // Should be highest relevance: brandzen(95)
    expect(result[0].relevanceScore).toBe(95)
  })

  it('handles limit of 2 (no mix requirement)', () => {
    const result = selectTopHashtags(sampleHashtags, 2)
    expect(result).toHaveLength(2)
  })
})
