# Platform Algorithm Report Template

## Output Schema

Produce a JSON object matching this structure:

```json
{
  "platforms": [
    {
      "name": "tiktok",
      "lastUpdated": "2026-02-28",
      "overallStrategy": "Focus on completion rate optimization and trending audio usage. TikTok's batch testing model rewards content that retains viewers above platform-average completion rates."
    }
  ],
  "algorithmPriorities": [
    {
      "platform": "tiktok",
      "priority": "Video completion rate",
      "weight": "critical",
      "description": "TikTok's #1 ranking signal. Videos watched to completion get exponentially more distribution through the batch testing model.",
      "recentChanges": "As of Q1 2026, longer videos (2-3 min) are now viable as TikTok has adjusted completion rate expectations by video length."
    }
  ],
  "rankingSignals": [
    {
      "platform": "tiktok",
      "signal": "Completion rate",
      "impact": "strong-positive",
      "description": "Percentage of viewers who watch the video to the end. The single most important metric for FYP distribution.",
      "actionable": true
    }
  ],
  "optimizationStrategies": [
    {
      "platform": "tiktok",
      "strategy": "Front-load the hook in first 0.5-1 second",
      "description": "Create an immediate visual or audio impact within the first half-second to maximize viewer retention and prevent scroll-past.",
      "expectedImpact": "high",
      "implementation": "Open with a bold text overlay, surprising visual, or compelling audio hook. Avoid intros, logos, or slow builds.",
      "antiPatterns": [
        "Starting with 'Hey guys, today we're going to...'",
        "Logo animations or brand intros",
        "Slow pans or establishing shots"
      ]
    }
  ],
  "recommendations": "Prioritized strategic summary of the most important algorithm optimization actions for the brand's product domain."
}
```

## Field Definitions

### platforms
- **name:** Platform identifier (reddit, tiktok, instagram, facebook)
- **lastUpdated:** ISO date of the most recent algorithm information used
- **overallStrategy:** High-level summary of the optimal approach for this platform

### algorithmPriorities
- **platform:** Which platform this priority applies to
- **priority:** Name of the algorithm priority factor
- **weight:** How important this factor is (low, medium, high, critical)
- **description:** Detailed explanation of this priority and how it affects distribution
- **recentChanges:** Optional. Any changes to this priority in the last 90 days

### rankingSignals
- **platform:** Which platform this signal applies to
- **signal:** Name of the ranking signal
- **impact:** How this signal affects content distribution (negative, neutral, positive, strong-positive)
- **description:** What this signal measures and how it works
- **actionable:** Whether creators can directly influence this signal (true/false)

### optimizationStrategies
- **platform:** Which platform this strategy applies to
- **strategy:** Name/label for this optimization approach
- **description:** Detailed explanation of the strategy and rationale
- **expectedImpact:** How much impact this strategy is expected to have (low, medium, high)
- **implementation:** Step-by-step guidance for implementing this strategy
- **antiPatterns:** Optional list of common mistakes to avoid when implementing

### recommendations
A comprehensive text summary synthesizing all platform findings into prioritized
actionable recommendations for the brand's product domain.
