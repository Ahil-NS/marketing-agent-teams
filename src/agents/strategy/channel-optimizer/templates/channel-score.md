# Channel Score Output Template

## Required JSON Output Structure

When audience profile data is available, the channel optimizer produces enhanced output
that includes platform-audience fit scores alongside the standard optimization plan.

The output includes these additional sections beyond the base optimization plan:

```json
{
  "platformScores": [
    {
      "platform": "<reddit | tiktok | facebook | instagram>",
      "fitScore": "<number 0-1 — overall platform-audience fit>",
      "audienceOverlap": "<number 0-1 — target audience presence on platform>",
      "engagementPotential": "<number 0-1 — expected engagement for this audience>",
      "recommendedFormats": ["<content formats optimized for this audience on this platform>"],
      "priority": "<primary | secondary | experimental | not-recommended>"
    }
  ],
  "postingFrequency": [
    {
      "platform": "<reddit | tiktok | facebook | instagram>",
      "recommended": "<e.g., '3-5 per week'>",
      "minimum": "<minimum to maintain presence>",
      "maximum": "<maximum before diminishing returns>",
      "rationale": "<why this frequency works for the audience>"
    }
  ],
  "contentFormatRecommendations": [
    {
      "format": "<content format>",
      "platforms": ["<which platforms>"],
      "audienceSegments": ["<which segments prefer this>"],
      "expectedEngagement": "<high | medium | low>",
      "rationale": "<why this format works for these segments>"
    }
  ],
  "crossPlatformStrategy": "<overall cross-platform coordination summary>"
}
```

## Fit Score Calculation

The fitScore for each platform is calculated as:

```
fitScore = (audienceOverlap × 0.4) + (engagementPotential × 0.35) + (contentFormatMatch × 0.25)
```

## Priority Classification

Based on fitScore:
- **primary** (0.7-1.0): Core platform — highest investment and posting frequency
- **secondary** (0.5-0.69): Important platform — moderate investment
- **experimental** (0.3-0.49): Worth testing — lower investment, monitor results
- **not-recommended** (0.0-0.29): Audience is minimal — redirect resources elsewhere

## Quality Requirements

- All fit scores must be between 0 and 1
- Each platform must have a priority classification
- Posting frequency must include minimum, recommended, and maximum
- Content format recommendations must reference audience data
- Cross-platform strategy must be specific and actionable

## Output Rules

1. These fields are ADDITIONAL to the base optimization plan
2. Include them when audience profile data is available in inputs
3. All scores must be justified by audience data, not arbitrary
4. Ensure valid JSON
