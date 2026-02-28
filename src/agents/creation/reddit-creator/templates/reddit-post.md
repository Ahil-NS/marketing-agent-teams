# Reddit Content Package Output Template

This template aligns with the `redditContentPackageSchema` JSON output format.
Produce a single valid JSON object with the following structure.

## Required JSON Structure

```json
{
  "posts": [
    {
      "postId": "string — unique identifier (e.g., 'post-001')",
      "title": "string — primary post title, optimized for the target subreddit",
      "body": "string — full post body in Reddit markdown format",
      "subreddit": "string — target subreddit name (without r/ prefix)",
      "flair": "string — appropriate flair for the post (check subreddit options)",
      "postType": "'text' | 'link' | 'image' — content type",
      "titleVariations": ["string — 2-3 alternative titles for A/B testing"],
      "firstComment": {
        "body": "string — first comment text (post within 30s of going live)",
        "timing": "string — 'within-30s' | 'within-1min'",
        "purpose": "'context' | 'question' | 'resource' | 'tldr'"
      },
      "engagementPlan": {
        "responseTemplates": ["string — template responses for anticipated questions"],
        "followUpTiming": "string — when to check back and engage (e.g., '2h', '4h')",
        "crossPostSubreddits": ["string — related subreddits for cross-posting (24h stagger)"]
      }
    }
  ],
  "comments": [
    {
      "postId": "string — references a post's postId",
      "commentBody": "string — follow-up comment text",
      "timing": "string — when to post relative to original post (e.g., '2h', '4h')",
      "purpose": "'engagement' | 'value-add' | 'followup' | 'data'"
    }
  ],
  "variations": [
    {
      "postId": "string — references a post's postId",
      "altTitle": "string — alternative title with different angle",
      "altBody": "string — alternative body text",
      "rationale": "string — why this variation might perform differently"
    }
  ],
  "metadata": {
    "targetSubreddits": ["string — all subreddits targeted in this package"],
    "postingSchedule": [
      {
        "postId": "string — references a post's postId",
        "date": "string — ISO date (YYYY-MM-DD)",
        "time": "string — 24h format (HH:MM)",
        "timezone": "string — timezone identifier (e.g., 'EST', 'PST')"
      }
    ],
    "crossPostStrategy": "string — overall cross-posting approach description",
    "estimatedEngagement": {
      "totalReach": "number — estimated total reach across all posts",
      "avgEngagementRate": "number — expected average engagement rate (0-1)"
    }
  },
  "generatedBy": "reddit-creator",
  "campaignId": "string — the campaignId from the input campaign plan"
}
```

## Field Requirements

- Every post MUST have at least 2 titleVariations
- Every post MUST have a firstComment with timing "within-30s"
- At least 1 comment per post for engagement
- At least 1 variation per post for A/B testing
- metadata.targetSubreddits must list ALL subreddits across all posts
- metadata.postingSchedule must have an entry for every post
- generatedBy MUST be "reddit-creator"
- campaignId MUST match the input campaign plan's planId
