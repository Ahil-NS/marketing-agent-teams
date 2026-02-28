# Viral Pattern Report Template

## Output Schema

Produce a JSON object matching this structure:

```json
{
  "viralPatterns": [
    {
      "platform": "tiktok",
      "pattern": "Hook-in-first-second transformation reveal",
      "description": "Videos that immediately show a striking visual or statement, then reveal the process/journey. High completion rate due to curiosity gap.",
      "frequency": "common",
      "examples": ["Example content description or URL"],
      "replicabilityScore": 4
    }
  ],
  "hookAnalysis": [
    {
      "hookType": "Curiosity Gap",
      "platform": "tiktok",
      "description": "Opening with an intriguing statement or visual that creates an information gap the viewer must watch to resolve.",
      "effectiveness": "very-high",
      "examples": ["'You won't believe what happens when...'", "'Wait for it...'"]
    }
  ],
  "captionStyles": [
    {
      "platform": "instagram",
      "style": "Micro-storytelling",
      "description": "Opening with a personal anecdote (2-3 sentences) before delivering the value proposition. Uses first-person voice and conversational tone.",
      "languagePatterns": ["First person narrative", "Emotional opener", "Call to action in final line"],
      "engagementImpact": "High save rate due to relatable storytelling combined with actionable advice"
    }
  ],
  "hashtagStrategies": [
    {
      "platform": "instagram",
      "strategy": "3-5-2 Stack (3 broad + 5 niche + 2 branded)",
      "recommendedCount": 10,
      "hashtagTypes": ["broad reach", "niche community", "branded"],
      "examples": ["#marketing #socialmedia #growthhacking #saasmarketing #contentcreator #YourBrand"]
    }
  ],
  "timingInsights": [
    {
      "platform": "tiktok",
      "bestDays": ["Tuesday", "Thursday", "Friday"],
      "bestHours": ["7:00 AM - 9:00 AM", "7:00 PM - 11:00 PM"],
      "timezone": "US Eastern (ET)",
      "rationale": "TikTok engagement peaks during morning scroll and evening entertainment windows. Tuesday and Thursday show highest FYP distribution rates."
    }
  ],
  "recommendations": "Strategic summary with top 3-5 actionable recommendations for the brand's product domain, synthesizing patterns, hooks, timing, and format insights."
}
```

## Field Definitions

### viralPatterns
- **platform:** Target platform name
- **pattern:** Short pattern name/label
- **description:** Detailed explanation of the pattern and why it works
- **frequency:** How often this pattern appears (rare, occasional, common, dominant)
- **examples:** Optional specific examples of content using this pattern
- **replicabilityScore:** 1-5 score (1 = very hard to replicate, 5 = easily replicable for brands)

### hookAnalysis
- **hookType:** Category of hook (Curiosity Gap, Contrarian Take, etc.)
- **platform:** Which platform this hook type is most effective on
- **description:** How this hook type works and why it captures attention
- **effectiveness:** How well it drives engagement (low, medium, high, very-high)
- **examples:** Optional specific examples of this hook type

### captionStyles
- **platform:** Target platform
- **style:** Name/label for this caption style
- **description:** Detailed explanation of the style and structure
- **languagePatterns:** Specific language techniques used
- **engagementImpact:** How this style affects engagement metrics

### hashtagStrategies
- **platform:** Target platform
- **strategy:** Name of the hashtag approach
- **recommendedCount:** Optimal number of hashtags for this platform
- **hashtagTypes:** Categories of hashtags in the strategy
- **examples:** Optional specific hashtag examples

### timingInsights
- **platform:** Target platform
- **bestDays:** Top-performing days of the week
- **bestHours:** Optimal time-of-day windows
- **timezone:** Reference timezone for the hours
- **rationale:** Why these times are optimal (based on audience behavior and algorithm)

### recommendations
A comprehensive text summary synthesizing all findings into actionable advice.
