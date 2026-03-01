# Facebook Visual Content Guide

## Image Post Optimization

### Best Practices for Facebook Image Posts
- **Native uploads** always outperform link posts with thumbnails
- **Square (1:1) or portrait (4:5)** formats occupy more screen real estate on mobile
- **Text overlay:** Facebook's old 20% text rule is relaxed, but minimal text still performs better
- **High resolution:** Minimum 1200x630px for link shares, 1080x1080px for square posts
- **Brand consistency:** Maintain recognizable visual style across all image posts

### Image Format Recommendations

| Content Type | Optimal Format | Aspect Ratio | Notes |
|---|---|---|---|
| Standard post | Square or portrait | 1:1 or 4:5 | Maximum feed visibility |
| Link share | Landscape | 1.91:1 | Shows in link preview card |
| Event cover | Landscape | 16:9 | Event page banner |
| Group post | Square | 1:1 | Groups favor native images |
| Carousel | Square | 1:1 | Consistent slide dimensions |

## AI Image Generation for Facebook

### When to Include Image Prompts
- **Always** for image-format posts (format === 'image')
- **Always** for carousel posts (each slide needs visual direction)
- **Recommended** for video posts (thumbnail image)
- **Optional** for text-only posts (but adding an image boosts engagement 2.3x)

### Generator Selection for Facebook
- **Flux** — Photorealistic lifestyle imagery, community photos, authentic scenes
- **Ideogram** — Infographics with text, data visualizations, branded quote cards
- **GPT Image** — Flexible concept images, illustrations, creative executions

### Facebook-Specific Image Prompt Tips
- Include descriptive alt-text language in prompts (accessibility matters for Facebook)
- Avoid overly polished/stock-photo aesthetics — Facebook audiences prefer authentic
- Group posts benefit from relatable, casual imagery over polished brand content
- Infographics should be self-contained — the image should tell the story without needing caption

### Image Prompt Format for Facebook
```json
{
  "promptId": "fb-img-001",
  "contentItemId": "fb-post-001",
  "promptText": "Detailed image generation prompt text",
  "generator": "flux | ideogram | gpt-image",
  "style": "photography | illustration | 3d-render | graphic-design",
  "aspectRatio": "1:1 | 4:5 | 16:9",
  "brandElements": ["brand color", "typography", "logo placement"],
  "visualConcept": "Brief concept description",
  "estimatedQuality": "high | medium | low"
}
```

## Video Thumbnail Selection

### Thumbnail Best Practices
- **Custom thumbnail > auto-generated** — always create a deliberate thumbnail
- **Face + text** — thumbnails with human faces and overlay text get highest CTR
- **High contrast** — ensure visibility at small mobile sizes
- **Curiosity gap** — thumbnail should tease content without revealing the payoff
- **Brand colors** — subtle brand color integration for recognition

### Thumbnail Prompt Considerations
- Generate a separate image prompt specifically for the video thumbnail
- Include text overlay directions in the prompt
- Specify the 16:9 or 1:1 aspect ratio
- Prioritize Ideogram for text-containing thumbnails, Flux for photorealistic

## Carousel Visual Flow

### Carousel Design Principles
1. **Cover slide hooks** — First slide must earn the swipe (bold statement, intriguing question, or striking visual)
2. **Visual consistency** — Every slide shares same color palette, typography, and layout grid
3. **Progressive revelation** — Each slide adds new information, building toward a conclusion
4. **Swipe indicators** — Include subtle "swipe →" cues, especially on first slide
5. **CTA on final slide** — Clear action: save, share, comment, visit link

### Facebook Carousel vs Instagram Carousel
- Facebook carousels can include different link destinations per card
- Facebook carousel cards show title + description text below each image
- Keep text on carousel images minimal — the card description handles heavy text

## Stories Visual Design

### Facebook Stories Specifications
- **Aspect ratio:** 9:16 (full-screen vertical)
- **Safe zone:** Keep critical content in center 80% (top/bottom have UI overlays)
- **Duration:** 1-20 seconds per frame, auto-advance
- **Interactive elements:** Polls, quizzes, questions, emoji sliders, links, music

### Stories Design Rules
- **Bold, readable text** — minimum 20pt equivalent, high contrast
- **Minimal content per frame** — one message per story frame
- **Brand colors as backgrounds** — solid or gradient backgrounds with text overlay
- **Progressive storytelling** — each frame advances the narrative
- **Engagement stickers** — place interactive elements in the lower-center safe zone

## Video Format Recommendations

| Content Type | Optimal Format | Aspect Ratio | Duration | Notes |
|---|---|---|---|---|
| Feed video | Square or portrait | 1:1 or 4:5 | 15-60s | Mobile-optimized, captions required |
| Stories | Vertical | 9:16 | 1-20s/frame | Full-screen immersive |
| Reels | Vertical | 9:16 | 15-60s | Counter-clockwise icon for discovery |
| Live replay | Landscape | 16:9 | Any | Archives for later viewing |
| In-stream | Landscape | 16:9 | 5-15s | Inserted into other videos |

### Video Content Priority Signals
- **Native upload** — Always upload directly; never share YouTube/external links
- **Captions/subtitles** — 85% of Facebook video is watched muted; always include text
- **First 3 seconds** — Must hook the viewer; lead with the strongest visual
- **Completion rate** — Algorithm rewards videos watched to the end; keep concise
- **Vertical preference** — Facebook is increasingly prioritizing vertical video in feed
