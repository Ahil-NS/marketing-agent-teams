import type {HashtagRecommendation} from '../schemas/hashtag-schema.js'

/**
 * Format hashtags for a specific platform.
 *
 * - TikTok: `#tag1 #tag2 #tag3` — space-separated, appended to caption
 * - Instagram: `#tag1 #tag2 #tag3` — can be in caption or first comment
 * - Facebook: `#tag1 #tag2` — inline with post text
 * - Reddit: returns empty string (Reddit doesn't use hashtags)
 */
export function formatHashtagsForPlatform(
  hashtags: HashtagRecommendation[],
  platform: string,
): string {
  if (platform === 'reddit') {
    return ''
  }

  if (hashtags.length === 0) {
    return ''
  }

  // All supported platforms use the same #tag format, space-separated
  return hashtags.map((h) => `#${h.tag}`).join(' ')
}

/**
 * Select the top N hashtags by relevance score, ensuring category mix.
 *
 * - Sorts by relevanceScore descending
 * - If limit >= 3, ensures at least 1 trending + 1 niche tag (if available)
 * - Returns at most `limit` hashtags
 * - If fewer hashtags than limit, returns all available
 */
export function selectTopHashtags(
  hashtags: HashtagRecommendation[],
  limit: number,
): HashtagRecommendation[] {
  if (hashtags.length <= limit) {
    return [...hashtags].sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  // Sort by relevance descending
  const sorted = [...hashtags].sort((a, b) => b.relevanceScore - a.relevanceScore)

  if (limit < 3) {
    return sorted.slice(0, limit)
  }

  // Ensure mix: at least 1 trending + 1 niche if available
  const trending = sorted.find((h) => h.category === 'trending')
  const niche = sorted.find((h) => h.category === 'niche')

  const selected: HashtagRecommendation[] = []
  const usedTags = new Set<string>()

  // Reserve spots for trending and niche
  if (trending) {
    selected.push(trending)
    usedTags.add(trending.tag)
  }

  if (niche) {
    selected.push(niche)
    usedTags.add(niche.tag)
  }

  // Fill remaining slots with top relevance score tags
  for (const h of sorted) {
    if (selected.length >= limit) break
    if (!usedTags.has(h.tag)) {
      selected.push(h)
      usedTags.add(h.tag)
    }
  }

  // Re-sort final selection by relevance
  return selected.sort((a, b) => b.relevanceScore - a.relevanceScore)
}
