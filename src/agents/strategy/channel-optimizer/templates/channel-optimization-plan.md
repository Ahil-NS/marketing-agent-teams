# Channel Optimization Plan Output Template

## Required JSON Output Structure

Produce a single JSON object with this exact structure:

```json
{
  "planId": "<unique-optimization-plan-id>",
  "campaignId": "<matching campaign plan ID>",
  "perPlatformRecommendations": [
    {
      "platform": "<reddit | tiktok | facebook | instagram>",
      "optimalPostingTimes": [
        {
          "day": "<day of week or YYYY-MM-DD>",
          "hours": ["<HH:MM format time slots>"],
          "timezone": "<timezone, e.g., EST, PST, UTC>",
          "rationale": "<why these times are optimal>"
        }
      ],
      "contentFormatPreferences": [
        {
          "format": "<content format name>",
          "algorithmBoost": "<strong | moderate | neutral | penalized>",
          "recommendation": "<what to do with this format>"
        }
      ],
      "antiPatterns": [
        {
          "pattern": "<what to avoid>",
          "risk": "<what happens if you do this>",
          "avoidance": "<how to avoid it>"
        }
      ],
      "optimizationNotes": "<platform-specific optimization summary>"
    }
  ],
  "seasonalOpportunities": [
    {
      "date": "<YYYY-MM-DD>",
      "eventName": "<event name>",
      "relevantThemes": ["<campaign themes relevant to this event>"],
      "suggestedContentTypes": ["<recommended content types>"],
      "platformRecommendations": ["<best platforms for this event>"],
      "estimatedImpact": "<high | medium | low>"
    }
  ],
  "crossPlatformStrategies": [
    {
      "strategy": "<strategy name>",
      "description": "<what this strategy involves>",
      "platforms": ["<which platforms>"],
      "expectedImpact": "<high | medium | low>"
    }
  ],
  "recommendations": "<overall optimization recommendations summary>",
  "generatedAt": "<ISO 8601 datetime>"
}
```

## Quality Requirements

- At least 3 optimal posting times per platform
- At least 2 anti-patterns per platform
- Content format preferences must reference current algorithm data
- All seasonal opportunities must include estimated impact
- Cross-platform strategies must be specific and actionable

## Output Rules

1. Output ONLY the JSON object — no markdown, no commentary
2. Ensure valid JSON
3. Each target platform must be represented in perPlatformRecommendations
4. At least 1 cross-platform strategy
