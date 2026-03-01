# Facebook Content Package Template

This template shows the expected JSON output structure for the Facebook Creator agent.
Output MUST validate against `facebookContentPackageSchema`.

## Complete Output JSON Structure

```json
{
  "posts": [
    {
      "postId": "fb-post-001",
      "copy": "Community-oriented post copy with engagement hook. Keep primary text under 125 characters for mobile. Use line breaks for readability.",
      "format": "text | image | video | carousel | link",
      "visualDescription": "Detailed description of the visual asset: composition, colors, subjects, text overlays, style. Must be sufficient for a designer or AI image generator to create the asset.",
      "engagementHook": "A specific question or prompt that drives meaningful comments. Example: 'What's one small change that made the biggest difference for you?'",
      "targetGroups": ["groupname1", "groupname2"]
    }
  ],
  "stories": [
    {
      "storyId": "fb-story-001",
      "frames": [
        {
          "frameNumber": 1,
          "content": "Frame content: text, question, or visual description",
          "visualDescription": "Visual details for this frame: background, colors, layout",
          "duration": 5
        }
      ],
      "interactions": ["poll", "quiz", "question", "countdown", "emoji-slider"],
      "duration": 15
    }
  ],
  "variations": [
    {
      "postId": "fb-post-001",
      "altCopy": "Alternative copy that tests a different angle, tone, or hook",
      "altVisual": "Alternative visual concept description",
      "rationale": "Why this variation may perform differently — what hypothesis it tests"
    }
  ],
  "metadata": {
    "postingSchedule": [
      {
        "contentId": "fb-post-001",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "timezone": "EST"
      }
    ],
    "groupTargets": ["target-group-1", "target-group-2"],
    "boostRecommendations": "Guidance on which posts to boost, budget, duration, and targeting",
    "crossPostStrategy": "Strategy for posting to Page vs Groups, timing stagger, modified intro copy"
  },
  "generatedBy": "facebook-creator",
  "campaignId": "plan-YYYY-MM-campaign-name"
}
```

## Field Guidelines

### posts[].copy
- Under 125 characters for the primary text visible on mobile
- If longer, front-load the most engaging content before the "See more" cut
- Use line breaks, emojis sparingly (2-3 max), and avoid ALL engagement bait

### posts[].format
- Must be one of: "text", "image", "video", "carousel", "link"
- Video and carousel formats get highest organic reach
- Link posts get lowest organic reach — use sparingly

### posts[].engagementHook
- Must drive meaningful comments (not simple reactions)
- Use open-ended questions that invite stories, opinions, or shared experiences
- NEVER use engagement bait patterns

### posts[].targetGroups
- List of Facebook Group names/identifiers to share content to
- Content should be customized for each group's culture and rules

### stories[].interactions
- Include at least one interactive element per story sequence
- Supported: "poll", "quiz", "question", "countdown", "emoji-slider"

### metadata.boostRecommendations
- Include budget, duration, audience targeting, and timing
- Example: "Boost after 24h organic performance, $20/day for 3 days, target: interest-based"

### metadata.crossPostStrategy
- Explain timing stagger between Page and Group posts
- Include guidance on how to modify intro copy for Groups
