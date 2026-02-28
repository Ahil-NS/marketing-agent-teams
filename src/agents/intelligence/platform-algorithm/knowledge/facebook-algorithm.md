# Facebook Algorithm Mechanics

## Facebook News Feed Algorithm

Facebook's algorithm (officially called the "discovery engine") determines what
content appears in users' News Feeds. It has evolved significantly over the years,
shifting toward "meaningful interactions" as the primary ranking philosophy.

## Core Algorithm Philosophy: Meaningful Interactions

In 2018, Facebook explicitly shifted to prioritize "meaningful interactions"—
content that sparks genuine conversation and connection between people. This
fundamental shift affects all content distribution decisions.

### What Counts as "Meaningful"
- **Two-way conversation:** Comment threads with back-and-forth replies
- **Friend-to-friend sharing:** Content shared between friends with personal context
- **Group discussion:** Active discussion within Facebook Groups
- **Reaction diversity:** Multiple reaction types (not just 👍) indicate emotional engagement
- **Long-form comments:** Substantive comments indicate genuine engagement

### What Does NOT Count (and Gets Suppressed)
- One-directional engagement (like-only without comments)
- Engagement bait ("Like if you agree!", "Tag a friend who...")
- Click-through engagement without return
- Mass sharing without personal context
- Bot-like engagement patterns

## Ranking Signal Categories

### Inventory Signals
- What content is available from all sources the user follows (friends, pages, groups)
- Facebook evaluates ~2,000+ potential stories per day per user

### Signal Processing
Facebook processes four main signal categories:

#### 1. Relationship Signals (Highest Weight)
- How close the viewer is to the content creator
- Message frequency, profile visits, tagging behavior
- Family connections get highest relationship weight
- Frequent commenters on each other's posts get boosted

#### 2. Content Type Signals
- Video watch time (native video > external links)
- Content format preference (if user engages more with video, show more video)
- Source type (friend post > page post > ad)

#### 3. Engagement Prediction
- Machine learning models predict how likely this user is to engage with this content
- Based on similar users' behavior, past engagement patterns
- Content topic relevance to user's demonstrated interests

#### 4. Quality Signals
- Content freshness (newer content preferred)
- Content originality (original > shared > aggregated)
- Author authority in the topic area
- Misleading content signals (clickbait classifiers)

## Video Algorithm Specifics

### Native Video Ranking
- Facebook heavily favors native video uploads over external links (YouTube, etc.)
- Live video gets 6x more engagement than regular video (and algorithmic boost)
- Videos > 3 minutes are eligible for in-stream ads (monetization incentive)
- **3-second view threshold:** Videos must retain viewers beyond 3 seconds

### Key Video Metrics
1. **Watch time** — Total minutes watched (most important)
2. **Completion rate** — Percentage watched to the end
3. **Return viewers** — Viewers who come back to watch again or seek out more content
4. **Original content** — Unique content vs. shared/reposted clips

## Facebook Groups

### Group Content Algorithm
- Group content gets higher News Feed priority than Page content
- Active Group discussions surface in members' feeds even if they haven't visited
- Group posts that generate comments get amplified to more members
- Admin-designated "Featured" posts get visibility boost

### Group Engagement Best Practices
- Post discussion prompts that encourage member participation
- Respond to comments quickly (conversation velocity matters)
- Use Group features: polls, events, Q&A posts
- Avoid cross-posting the same content to multiple Groups (spam signal)

## Share Distance and Viral Mechanics

### Share Distance
- **First-degree shares:** A user shares content with their friends
- **Second-degree shares:** Friends of friends reshare the content
- **Third-degree+:** Content has "escaped" the original audience
- Content with higher share distance gets exponential distribution

### Viral Content Signals
- High comment-to-like ratio (indicates conversation-starting content)
- Share velocity (how fast shares accumulate)
- Diverse engagement sources (engagement from multiple demographics/regions)
- Cross-group sharing (content shared across multiple Facebook Groups)

## Content Type Weighting (Current)

### Descending Priority
1. **Live video** — Highest organic reach
2. **Native video** — Strong distribution
3. **Image posts** — Moderate distribution
4. **Text-only posts** — Can perform well if conversation-starting
5. **Link posts** — Lowest organic reach (sends users off-platform)

## Time Decay Curve

- Facebook content has a longer shelf life than Instagram/TikTok
- A typical post's reach curve extends 5-6 hours after posting
- Highly engaging posts can continue getting distribution for 24-48 hours
- Evergreen content in Groups can surface for weeks if engagement continues
- Algorithm periodically resurfaces old content if it becomes relevant again

## Anti-Patterns (Algorithmic Suppression)

1. **Engagement bait** — Explicitly asking for likes, shares, tags, or comments
   in manipulative ways. Facebook's classifier actively detects and penalizes this.
2. **Clickbait headlines** — Misleading or sensationalized headlines that
   withhold information. Facebook has a dedicated clickbait classifier.
3. **External links** — Posts with external URLs get reduced distribution (Facebook
   wants users to stay on platform).
4. **Recycled content** — Posting the same content repeatedly or reposting others'
   content without original commentary.
5. **Misleading health/science claims** — Content reviewed by fact-checkers gets
   dramatically reduced distribution.
6. **Excessive posting frequency** — Pages that post too frequently (10+ per day)
   see diminishing returns per post.

## Recent Algorithm Focus Areas (Track These)

- AI-recommended content (content from sources you DON'T follow) is increasing
  in Feed — similar to TikTok's discovery model
- Reels integration into Facebook (cross-posted from Instagram) is getting distribution
- Short-form video is being prioritized as Facebook competes with TikTok
- Creator monetization programs affect how the algorithm rewards creator content
- Facebook is investing in AI content recommendations — "suggested for you" content
  is growing as a share of the Feed
