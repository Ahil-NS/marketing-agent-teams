# Audience Profile Output Template

## Required JSON Output Structure

Produce a single JSON object with this exact structure matching `audienceProfileSchema`:

```json
{
  "profileId": "<unique-profile-id, e.g., 'ap-2026-03-wellness'>",
  "brandName": "<brand name from inputs>",
  "segments": [
    {
      "segmentName": "<descriptive segment name>",
      "size": "<TAM/SAM/SOM estimate, e.g., 'TAM: 5M, SAM: 500K, SOM: 50K'>",
      "demographics": {
        "ageRange": "<e.g., '25-34'>",
        "gender": "<e.g., 'skews female (65%)'>",
        "location": "<geographic focus>",
        "income": "<income range>",
        "education": "<education level>",
        "profession": "<typical professions>"
      },
      "psychographics": {
        "values": ["<core values>"],
        "lifestyle": "<lifestyle description>",
        "motivations": ["<key motivations>"],
        "valsType": "<VALS framework type>"
      },
      "primaryPlatforms": ["reddit", "tiktok", "facebook", "instagram"],
      "contentFormats": ["<preferred content formats>"],
      "engagementPatterns": "<how this segment engages with content>"
    }
  ],
  "demographics": {
    "primaryAge": "<dominant age range across all segments>",
    "genderSplit": "<overall gender distribution>",
    "topLocations": ["<top geographic markets>"],
    "incomeRange": "<overall income range>"
  },
  "psychographics": {
    "coreValues": ["<shared values across segments>"],
    "sharedMotivations": ["<common motivations>"],
    "dominantValsTypes": ["<most common VALS types>"]
  },
  "painPoints": [
    {
      "painPoint": "<description of the pain point>",
      "severity": "<high | medium | low>",
      "segments": ["<which segments experience this>"],
      "contentOpportunity": "<how to address this in content>"
    }
  ],
  "contentPreferences": [
    {
      "format": "<content format, e.g., 'short-form video'>",
      "platforms": ["<where this format works>"],
      "segments": ["<which segments prefer this>"],
      "engagementLevel": "<high | medium | low>"
    }
  ],
  "platformUsage": [
    {
      "platform": "<reddit | tiktok | facebook | instagram>",
      "audienceSize": "<estimated audience size on this platform>",
      "primarySegments": ["<segments most active here>"],
      "usagePattern": "<how audience uses this platform>",
      "peakActivity": "<when audience is most active>",
      "contentPreferences": ["<preferred content on this platform>"]
    }
  ],
  "personas": [
    {
      "name": "<persona name, e.g., 'Wellness-Seeking Sarah'>",
      "ageRange": "<specific age range>",
      "segment": "<which segment this persona represents>",
      "demographics": "<key demographic summary>",
      "psychographicProfile": "<personality and lifestyle summary>",
      "primaryPlatforms": ["<top 2-3 platforms>"],
      "contentPreferences": ["<preferred content types>"],
      "painPoints": ["<top pain points>"],
      "behavioralIndicators": ["<observable digital behaviors>"],
      "messagingAngle": "<best way to reach this persona>"
    }
  ]
}
```

## Quality Requirements

- Minimum 2 distinct segments
- Each segment must have at least 5 defining characteristics
- Every segment must include platform usage for at least 2 platforms
- Pain points must be specific and actionable
- Each persona must have at least 3 behavioral indicators
- Platform usage patterns must cite observable data or benchmarks

## Output Rules

1. Output ONLY the JSON object — no markdown, no commentary
2. Ensure valid JSON
3. All target platforms must be represented in platformUsage
4. At least 3 personas covering different segments
