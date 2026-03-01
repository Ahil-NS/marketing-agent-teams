# Brand Voice Guidelines Framework

## Voice Dimensions
- **Tone**: The emotional quality (friendly, authoritative, playful, etc.)
- **Language level**: Casual, conversational, professional, technical
- **Vocabulary**: Preferred terms, prohibited words, jargon guidelines
- **Personality**: Brand character traits and how they manifest
- **Values**: What the brand stands for and how it's expressed

## Review Criteria
- Does the content sound like it comes from this brand?
- Is the tone appropriate for the platform and audience?
- Are brand-specific terms used correctly?
- Does the messaging align with brand positioning?
- Are there any off-brand elements?

## Scoring Methodology

### Quality Score Calculation (0-100)

The overall quality score is a weighted aggregate of four sub-scores:

| Sub-Score | Weight | Description |
|---|---|---|
| toneAlignment | 30% | How well the content tone matches the configured brand tone |
| styleConsistency | 30% | Whether writing style matches the communicationStyle setting |
| principleAdherence | 25% | How well content upholds each brand principle |
| Banned phrase penalty | 15% | Deducted proportionally per violation found |

**Formula**: `qualityScore = (toneAlignment * 0.30) + (styleConsistency * 0.30) + (principleAdherence * 0.25) + (bannedPhraseScore * 0.15)`

Where `bannedPhraseScore = 100 - (violations * penaltyPerViolation)` (clamped to 0-100).

### Sub-Score Rubrics

#### Tone Alignment (0-100)
- **90-100**: Content tone perfectly matches configured tone across all sections
- **70-89**: Tone is largely consistent with minor deviations in phrasing
- **50-69**: Noticeable tone shifts — switches between formal/informal inappropriately
- **30-49**: Significant tone mismatch — content reads as a different brand personality
- **0-29**: Complete tone violation — opposite of configured tone

#### Style Consistency (0-100)
- **90-100**: Communication style perfectly matches configuration
- **70-89**: Style mostly matches with occasional deviations
- **50-69**: Inconsistent style — mixes approaches (e.g., direct and verbose)
- **30-49**: Style largely mismatched with configured communicationStyle
- **0-29**: No resemblance to configured communication style

#### Principle Adherence (0-100)
- **90-100**: All brand principles clearly reflected in content
- **70-89**: Most principles present, one may be weakly represented
- **50-69**: Some principles missing or contradicted
- **30-49**: Multiple principles violated or ignored
- **0-29**: Content actively contradicts brand principles

### Issue Severity Classification

- **high**: Content poses brand risk, contains banned phrases, or fundamentally contradicts brand voice. Blocks publication.
- **medium**: Noticeable deviation that should be corrected. May or may not block depending on aggregate score.
- **low**: Minor stylistic preference that could be improved but doesn't harm brand perception.

## Scoring Framework Summary
- **90-100**: Excellent brand alignment, publish-ready
- **70-89**: Good alignment, minor adjustments needed
- **50-69**: Moderate issues, significant revisions needed
- **Below 50**: Major brand voice violations, rewrite recommended

## Common Brand Voice Issues
- Tone mismatches (too formal, too casual)
- Using competitor terminology
- Inconsistent personality across platforms
- Claims that don't match brand positioning
- Banned phrase usage (exact or semantic matches)
- Style inconsistency within a single content piece

## Pattern Learning Guidelines

Patterns are reusable corrections identified during review that improve future content:

### Pattern Types
- **tone-correction**: Recurring tone adjustments (e.g., "Instagram content consistently too formal")
- **style-adjustment**: Style changes that keep appearing (e.g., "sentences too complex for TikTok captions")
- **phrase-replacement**: Specific phrases to avoid/replace (e.g., "always replaces 'utilize' with 'use'")
- **structure-change**: Content structure issues (e.g., "Reddit posts need more paragraph breaks")

### When to Report a Pattern
- The same correction appears across 2+ content items in one review
- A correction matches a previously observed pattern from memory context
- The issue is likely to recur in future content generation
- Confidence should reflect how generalizable the pattern is (0.5-1.0)
