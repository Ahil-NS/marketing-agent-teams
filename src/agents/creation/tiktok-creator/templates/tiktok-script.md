# TikTok Content Package Output Template

This template aligns with the `tiktokContentPackageSchema` JSON output format.
Produce a single valid JSON object with the following structure.

## Required JSON Structure

```json
{
  "scripts": [
    {
      "scriptId": "string — unique identifier (e.g., 'script-001')",
      "hook": "string — first 2 seconds, attention-grabbing opening",
      "body": "string — main content with pattern interrupts noted in brackets",
      "cta": "string — clear call-to-action or satisfying payoff",
      "onScreenText": [
        "string — text overlays in chronological order (include timing, e.g., '[0-3s] Text here')"
      ],
      "duration": "'15s' | '30s' | '60s'",
      "visualDirections": "string — detailed visual description for video creation"
    }
  ],
  "captions": [
    {
      "scriptId": "string — references a script's scriptId",
      "captionText": "string — SEO-optimized caption (80-150 chars, keywords front-loaded)",
      "hashtags": ["string — 4-6 hashtags in tier order: trending, niche, brand"],
      "keywords": ["string — primary and secondary keywords targeted in this content"]
    }
  ],
  "videoPrompts": [
    {
      "scriptId": "string — references a script's scriptId",
      "veo3Prompt": "string — complete Veo 3 video generation prompt with scene, subject, style, motion, duration, audio",
      "style": "'cinematic' | 'lo-fi' | 'clean' | 'vibrant' | 'raw' | 'editorial'",
      "duration": "'15s' | '30s' | '60s'",
      "visualElements": ["string — key visual elements for brand alignment"]
    }
  ],
  "variations": [
    {
      "scriptId": "string — references a script's scriptId",
      "altHook": "string — alternative hook for A/B testing",
      "altCta": "string — alternative CTA",
      "rationale": "string — why this variation might perform differently"
    }
  ],
  "metadata": {
    "trendingSounds": [
      {
        "name": "string — trending sound name or description",
        "relevance": "string — how this sound fits the content"
      }
    ],
    "effects": ["string — suggested TikTok effects to apply"],
    "postingSchedule": [
      {
        "scriptId": "string — references a script's scriptId",
        "date": "string — ISO date (YYYY-MM-DD)",
        "time": "string — 24h format (HH:MM)",
        "timezone": "string — timezone identifier (e.g., 'EST', 'PST')"
      }
    ],
    "hashtagStrategy": "string — overall hashtag approach description"
  },
  "generatedBy": "tiktok-creator",
  "campaignId": "string — the campaignId from the input campaign plan"
}
```

## Field Requirements

- Every script MUST include onScreenText with at least 2 entries
- Every script MUST have a corresponding caption entry (matched by scriptId)
- Every script MUST have a corresponding videoPrompt entry (matched by scriptId)
- At least 1 variation per script for A/B testing
- Captions MUST contain 4-6 hashtags in tier order (trending, niche, brand)
- Captions MUST include keywords array covering all 4 SEO layers
- Video prompts MUST include scene, style, motion, and duration
- metadata.postingSchedule must have an entry for every script
- generatedBy MUST be "tiktok-creator"
- campaignId MUST match the input campaign plan's planId

## 4-Layer SEO Checklist (Per Script)

For each content piece, verify:
1. Caption: Primary keyword in first 40 characters
2. On-screen text: Primary keyword visible in first 3 seconds
3. Script body: Primary keyword spoken 2-3 times naturally
4. Hashtags: Primary keyword as niche hashtag
