# Campaign Plan Output Template

## Required JSON Output Structure

Produce a single JSON object with this exact structure:

```json
{
  "planId": "<unique-plan-id>",
  "campaignName": "<descriptive campaign name, 3-100 characters>",
  "objective": "<clear campaign objective statement, 10-500 characters>",
  "targetAudience": "<target audience description, 5-200 characters>",
  "contentThemes": [
    {
      "theme": "<theme name>",
      "rationale": "<why this theme was chosen — cite specific research intelligence findings>",
      "contentTypes": ["<content type 1>", "<content type 2>"],
      "platformFit": {
        "<platform>": <0.0-1.0 fit score>
      }
    }
  ],
  "timeline": {
    "startDate": "<YYYY-MM-DD>",
    "endDate": "<YYYY-MM-DD>"
  },
  "successMetrics": [
    {
      "metric": "<metric name>",
      "target": <positive number>,
      "platform": "<optional: which platform this metric applies to>"
    }
  ],
  "budget": {
    "estimatedCost": <estimated cost in USD>,
    "optimizations": ["<cost optimization strategy 1>", "<strategy 2>"]
  },
  "researchInsights": {
    "trendSummary": "<key trend findings that informed the plan>",
    "competitorInsights": "<competitive intelligence that shaped strategy>",
    "opportunityStatement": "<core opportunity — why this campaign will succeed>"
  },
  "createdAt": "<ISO 8601 datetime>",
  "createdBy": "content-strategist"
}
```

## Field Requirements

- **planId**: Unique string identifier (e.g., "plan-2026-03-wellness-spring")
- **campaignName**: 3-100 characters, reflects brand tone
- **objective**: 10-500 characters, specific and measurable
- **contentThemes**: Array of 3-5 themes (minimum 1, maximum 7)
  - Each theme must have rationale citing research intelligence
  - platformFit scores must be justified by algorithm and trend data
- **timeline**: startDate and endDate in YYYY-MM-DD format, 7-90 day range
- **successMetrics**: At least 1, all targets must be positive numbers
- **budget.estimatedCost**: Non-negative number
- **researchInsights**: All three fields required, must reference specific research findings
- **createdAt**: ISO 8601 datetime string
- **createdBy**: Must be "content-strategist"

## Output Rules

1. Output ONLY the JSON object — no markdown, no commentary
2. Ensure valid JSON (proper quoting, no trailing commas)
3. All string values must be non-empty
4. Platform fit scores must be between 0.0 and 1.0
5. Timeline must be realistic and within 7-90 days
