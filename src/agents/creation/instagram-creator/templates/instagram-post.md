# Instagram Content Package Template

This template shows the expected JSON output structure for the Instagram Creator agent.
Output MUST validate against `instagramContentPackageSchema`.

## Complete Output JSON Structure

```json
{
  "posts": [
    {
      "postId": "ig-post-001",
      "caption": "Hook line that stops the scroll.\n\nValue body with key insights, tips, or story.\n\nCTA: What's your experience with [topic]? Drop your answer below 👇",
      "hashtags": ["#broad1", "#broad2", "#niche1", "#niche2", "#niche3", "#brand1"],
      "visualConcept": "Detailed description of the visual concept: what's shown, the composition, the mood, the story the image tells",
      "format": "static | carousel | reel",
      "artDirection": "Color palette (e.g., warm earth tones), composition style (e.g., centered, rule of thirds), photography/illustration style, typography notes (font, size, weight)"
    }
  ],
  "reels": [
    {
      "reelId": "ig-reel-001",
      "hook": "First-frame hook text or concept that stops the scroll within 1 second",
      "script": "[0-2s] Hook: Bold statement on screen. [3-8s] Body: Key point with B-roll. [9-15s] Supporting evidence. [16-25s] Value delivery. [26-30s] CTA and follow prompt.",
      "musicSuggestion": "Trending audio name OR mood description (e.g., 'upbeat lo-fi, morning energy feel')",
      "visualDirections": "Shot-by-shot visual direction: camera angles, transitions, text overlays, pattern interrupts, lighting, and setting for each segment",
      "duration": 30
    }
  ],
  "stories": [
    {
      "storyId": "ig-story-001",
      "frames": [
        {
          "frameNumber": 1,
          "content": "Frame content: text, question, visual description",
          "visualDescription": "Visual details: background color/image, text placement, font style",
          "duration": 5
        }
      ],
      "stickers": ["poll", "quiz", "question", "emoji-slider", "countdown"],
      "interactions": ["poll: Morning routine vs Evening routine?", "question: What's your #1 wellness tip?"]
    }
  ],
  "carousels": [
    {
      "carouselId": "ig-carousel-001",
      "slides": [
        {
          "slideNumber": 1,
          "content": "Slide text content or key message",
          "visualDescription": "Visual details: layout, colors, imagery, typography"
        }
      ],
      "swipeNarrative": "The story arc across all slides: how the narrative progresses from hook to payoff",
      "coverSlide": "Cover slide design: bold title, value promise, 'Swipe →' indicator, eye-catching visual"
    }
  ],
  "imagePrompts": [
    {
      "postId": "ig-post-001",
      "promptText": "Detailed AI image generation prompt with scene, subject, lighting, colors, composition, mood, and style specifications",
      "style": "photography | illustration | 3d-render | graphic-design",
      "aspectRatio": "1:1 | 4:5 | 9:16",
      "generator": "flux | ideogram | gpt-image"
    }
  ],
  "variations": [
    {
      "postId": "ig-post-001",
      "altCaption": "Alternative caption testing different hook angle or CTA",
      "altVisual": "Alternative visual concept description",
      "rationale": "What hypothesis this variation tests and why it might perform differently"
    }
  ],
  "metadata": {
    "postingSchedule": [
      {
        "contentId": "ig-post-001",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "timezone": "EST"
      }
    ],
    "hashtagStrategy": "Overall strategy: 3-5 broad + 10-15 niche + 2-3 brand. Rotate every 2-3 posts. Total 20-25 per post.",
    "aestheticNotes": "Grid aesthetic plan, color palette consistency, visual style notes across the campaign"
  },
  "generatedBy": "instagram-creator",
  "campaignId": "plan-YYYY-MM-campaign-name"
}
```

## Field Guidelines

### posts[].caption
- Hook line must fit in ~125 characters (before "...more" truncation on mobile)
- Include line breaks for readability
- End with CTA or question that drives comments/saves
- Emojis: 2-5 per caption maximum

### posts[].hashtags
- 20-25 hashtags per post (optimal range)
- Mix: 3-5 broad + 10-15 niche + 2-3 brand + 2-3 trending/seasonal
- Avoid banned or restricted hashtags
- Rotate sets every 2-3 posts

### posts[].artDirection
- Must include: color palette, composition style, typography, mood
- Sufficient detail for a designer or AI to create the asset

### reels[].hook
- Must stop the scroll in 1 second
- Can be text overlay, visual, or spoken statement

### reels[].duration
- Number in seconds (15, 30, or 60)
- 15-30s for highest completion rates

### carousels[].coverSlide
- Must include value promise and swipe indicator
- Design for maximum visual impact in the feed

### imagePrompts[].style
- Must be one of: "photography", "illustration", "3d-render", "graphic-design"

### imagePrompts[].aspectRatio
- Must be one of: "1:1", "4:5", "9:16"
- Match to intended post format (1:1 square, 4:5 portrait feed, 9:16 stories/reels)
