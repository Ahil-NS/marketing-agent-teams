# Hook Writer Output Template

Output MUST be valid JSON matching the `hookWriterOutputSchema` format.

## Required JSON Structure

```json
{
  "hooks": [
    {
      "hookId": "hook-001",
      "contentItemId": "{{contentItemId}}",
      "platform": "{{platform}}",
      "hookText": "{{generated_hook_text}}",
      "triggerType": "{{trigger_type}}",
      "hookArchetype": "{{archetype}}",
      "confidenceScore": {{score_0_to_1}},
      "characterCount": {{char_count}}
    }
  ],
  "topPicks": [
    {
      "contentItemId": "{{contentItemId}}",
      "platform": "{{platform}}",
      "recommendedHookId": "{{best_hook_id}}",
      "rationale": "{{why_this_hook_is_recommended}}"
    }
  ],
  "abPairs": [
    {
      "pairId": "pair-001",
      "contentItemId": "{{contentItemId}}",
      "platform": "{{platform}}",
      "hookA": "{{hook_id_a}}",
      "hookB": "{{hook_id_b}}",
      "variationStrategy": "{{what_differs_between_a_and_b}}",
      "rationale": "{{why_this_pair_is_worth_testing}}"
    }
  ],
  "analysis": {
    "totalHooksGenerated": {{total_count}},
    "avgConfidenceScore": {{avg_score}},
    "platformBreakdown": {
      "reddit": {{reddit_count}},
      "tiktok": {{tiktok_count}},
      "facebook": {{facebook_count}},
      "instagram": {{instagram_count}}
    },
    "triggerDistribution": {
      "curiosity": {{count}},
      "urgency": {{count}},
      "social-proof": {{count}},
      "fomo": {{count}},
      "authority": {{count}},
      "identity": {{count}},
      "loss-aversion": {{count}},
      "novelty": {{count}}
    }
  }
}
```

## Field Descriptions

### hooks[]
- **hookId**: Unique identifier (format: `hook-NNN`)
- **contentItemId**: References the input ContentItem this hook is for
- **platform**: One of: `reddit`, `tiktok`, `facebook`, `instagram`
- **hookText**: The actual hook text, respecting platform character limits
- **triggerType**: Primary psychological trigger used (from taxonomy)
- **hookArchetype**: Which of the 12 archetypes was used (question, statistic, story, contrarian, how-to, list, challenge, confession, transformation, prediction, analogy, warning)
- **confidenceScore**: 0.0-1.0 engagement prediction
- **characterCount**: Exact character count of hookText

### topPicks[]
- One per content item per platform
- Must reference an existing hookId from hooks[]
- Rationale explains why this hook is the best choice

### abPairs[]
- At least one pair per content item
- hookA and hookB must reference existing hookIds
- variationStrategy describes what differs (trigger-type, structure, tone, framing, length)
- Rationale explains the hypothesis being tested

### analysis
- Summary statistics for the full output
- platformBreakdown counts hooks per platform
- triggerDistribution counts hooks per trigger type
