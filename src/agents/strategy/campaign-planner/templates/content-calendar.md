# Content Calendar Output Template

## Required JSON Output Structure

Produce a single JSON object with this exact structure:

```json
{
  "calendarId": "<unique-calendar-id>",
  "campaignId": "<matching campaign plan ID>",
  "period": {
    "startDate": "<YYYY-MM-DD>",
    "endDate": "<YYYY-MM-DD>",
    "duration": "<weekly | 14-day | monthly>"
  },
  "entries": [
    {
      "date": "<YYYY-MM-DD>",
      "platform": "<reddit | tiktok | facebook | instagram>",
      "contentType": "<promotional | educational | engagement | seasonal | thought-leadership | community | behind-the-scenes>",
      "theme": "<which campaign theme this supports>",
      "contentDescription": "<what this content piece should be about>",
      "estimatedEngagement": {
        "reach": <estimated reach number>,
        "engagementRate": <0.0-1.0>
      },
      "hashtags": ["<optional hashtag suggestions>"],
      "callToAction": "<optional CTA>",
      "notes": "<optional scheduling or content notes>"
    }
  ],
  "platformBalance": {
    "<platform>": <0.0-1.0 proportion>
  },
  "contentTypeBalance": {
    "<contentType>": <0.0-1.0 proportion>
  },
  "seasonalEvents": [
    {
      "date": "<YYYY-MM-DD>",
      "eventName": "<event name>",
      "relevantThemes": ["<campaign themes relevant to this event>"],
      "suggestedContentTypes": ["<recommended content types>"],
      "platformRecommendations": ["<best platforms for this event>"],
      "estimatedImpact": "<high | medium | low>"
    }
  ],
  "notes": "<overall calendar strategy notes>",
  "lastUpdated": "<ISO 8601 datetime>"
}
```

## Balance Rules

- platformBalance values MUST sum to approximately 1.0 (±0.05)
- contentTypeBalance MUST include at least 3 content types
- No single content type should exceed 40% of entries
- Each campaign theme should appear in at least 2 entries

## Output Rules

1. Output ONLY the JSON object — no markdown, no commentary
2. Ensure valid JSON
3. Minimum 1 entry in entries array
4. All dates must be in YYYY-MM-DD format
5. Platform must be one of: reddit, tiktok, facebook, instagram
