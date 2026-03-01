# Atomized Content Output Template

Output your atomized content as a single valid JSON object with the following structure:

```json
{
  "atomizationId": "atomize-{unique-id}",
  "sourceContentId": "{source-content-id-from-input}",
  "sourceContentType": "campaign-theme | content-calendar-entry | blog-post | article",
  "microContent": [
    {
      "itemId": "atom-{sequence}-{platform}",
      "platform": "reddit | tiktok | facebook | instagram",
      "contentType": "{platform-appropriate-content-type}",
      "title": "{micro-content-title}",
      "body": "{full-micro-content-body}",
      "metadata": {
        "format": "{specific-format-within-content-type}",
        "characterCount": 0,
        "hashtags": [],
        "engagementHook": "",
        "additionalPlatformData": {}
      },
      "sourceSection": "{specific-section-of-source-content}",
      "traceabilityLink": "{sourceContentId}#{section-slug}"
    }
  ]
}
```

## Field Requirements

### atomizationId
- Unique identifier for this atomization run
- Format: `atomize-{3-digit-sequence}`

### sourceContentId
- The ID of the source content being atomized
- Must match the input's source content identifier

### sourceContentType
- Type of the source content
- One of: `campaign-theme`, `content-calendar-entry`, `blog-post`, `article`

### microContent[]
Each item represents a single platform-specific micro-content piece.

- **itemId**: Unique ID within this atomization, format `atom-{seq}-{platform}`
- **platform**: Target platform (`reddit`, `tiktok`, `facebook`, `instagram`)
- **contentType**: Platform-specific type (e.g., `thread`, `script-hook`, `carousel`, `post`)
- **title**: Headline or hook for the micro-content
- **body**: Complete content body ready for posting
- **metadata**: Platform-specific metadata (varies by platform)
- **sourceSection**: Human-readable description of which source section this came from
- **traceabilityLink**: Machine-readable link format: `{sourceContentId}#{section-slug}`

## Platform-Specific contentType Values

| Platform | contentType Values |
|---|---|
| Reddit | `thread`, `discussion`, `ama-qa` |
| TikTok | `script-hook`, `three-things`, `reaction` |
| Facebook | `insight-post`, `question-post`, `carousel-summary`, `video-teaser` |
| Instagram | `carousel`, `caption-post`, `reel-hook`, `quote-graphic` |
