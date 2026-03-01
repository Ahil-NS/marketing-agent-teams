# Platform Hashtag Guide

## TikTok (5-7 hashtags recommended, max 8)

### Algorithm Factors
- FYP algorithm indexes: caption text, OCR text overlay, audio keywords, hashtags
- Hashtags are ONE of four indexable discovery layers — not the primary one
- TikTok's recommendation engine weighs watch time and engagement above hashtag relevance

### Strategy
- **Trending (2-3):** FYP discovery — find what's trending in the content niche right now
- **Niche (2):** Community targeting — reach specific sub-communities interested in this exact topic
- **Branded (1):** Campaign tracking — use the brand's campaign or product hashtag
- Mix should be: ~40% trending, ~30% niche, ~10% branded, ~10% evergreen, ~10% community

### Best Practices
- Research active trending hashtags via search, not assumptions
- Avoid generic tags (#fyp, #foryou) — debated effectiveness, configurable per brand
- Avoid banned hashtags (check before recommending)
- Rotate hashtag sets between posts to avoid algorithmic penalty
- Keep hashtags after caption text, space-separated

### Limits
- Recommended: 5 hashtags
- Min: 3, Max: 8
- Caption char limit: 4000 characters (hashtags included)

---

## Instagram (15-20 optimal, max 30)

### Algorithm (2026)
- Instagram's algorithm weighs RELEVANCE over volume since 2023 update
- Posts with 20-30 highly relevant hashtags outperform posts with 5 generic ones
- Saves and shares are weighted highest in distribution

### 3-Tier Strategy
1. **High-reach (5 tags, >1M posts):** Broad discovery, expect high competition
2. **Mid-range (5 tags, 100K-1M posts):** Balanced discoverability and competition
3. **Niche (5 tags, <100K posts):** Targeted communities, lower competition, higher engagement rate
4. **Branded (2-3 tags):** Campaign tracking, community building
5. **Evergreen (2-3 tags):** Consistent long-term discovery

### Best Practices
- First comment placement preferred for clean aesthetics
- Caption placement works equally well for algorithm
- Avoid overused generic tags (#love, #instagood) unless genuinely relevant
- Include location-specific hashtags when applicable
- Monitor which hashtags drive profile visits vs saves

### Limits
- Recommended: 15 hashtags
- Min: 5, Max: 30
- Caption char limit: 2200 characters

---

## Facebook (1-3 hashtags max)

### Algorithm
- Facebook penalizes hashtag stuffing — fewer is better
- Content-relevant hashtags improve discoverability in groups
- Video content with minimal hashtags performs best

### Strategy
- **Trending (1-2):** Only if genuinely relevant to content
- **Branded (1):** Campaign or company hashtag
- No niche/community hashtags needed — Facebook's algorithm depends on engagement signals

### Best Practices
- Inline hashtags within post text (not appended)
- Only use hashtags when they add discoverability value
- Focus on group-specific hashtags when posting to groups
- Avoid more than 3 — algorithm performance drops

### Limits
- Recommended: 3 hashtags
- Min: 1, Max: 10
- Post char limit: 63,206 characters

---

## Reddit (0 hashtags)

### Why No Hashtags
- Reddit does NOT use hashtags for content categorization
- Subreddits provide the topic categorization system
- User flair provides additional context
- Adding hashtags to Reddit content appears spammy and inauthentic

### What to Return
- Return EMPTY hashtag set for Reddit content (empty `hashtags` array)
- Set `mixBreakdown` to all zeros
- Set `totalReach` to `'low'`
- Note in `strategy` that Reddit relies on subreddit selection for targeting

### Reddit Discovery Factors (handled by other agents)
- Title optimization (SEO agent)
- Subreddit selection (platform specialist)
- Post timing (timing optimizer)
- Community engagement style (content creator)
