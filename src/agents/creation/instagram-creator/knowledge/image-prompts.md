# AI Image Generation Prompt Patterns for Instagram

## Generator-Specific Best Practices

### Flux (Best for: Photorealistic, artistic styles)

**Style Tokens:**
- `editorial photography`, `lifestyle photography`, `product photography`
- `cinematic lighting`, `golden hour`, `soft diffused light`
- `shallow depth of field`, `bokeh background`, `lens flare`
- `film grain`, `35mm film`, `medium format`
- `muted earth tones`, `warm color grading`, `desaturated pastels`

**Prompt Structure:**
```
[Subject description]. [Scene/environment]. [Lighting]. [Color palette]. [Camera/lens]. [Mood]. [Aspect ratio], [quality].
```

**Example:**
> A person in their late 20s sitting cross-legged on a bed, writing in a leather-bound journal. Bright modern bedroom with natural morning sunlight streaming through sheer linen curtains. Warm golden amber tones, shallow depth of field focused on hands and journal. Earth-tone color palette: cream bedding, warm wood, sage green accents. Editorial photography style. 4:5 portrait aspect ratio, high resolution.

### Ideogram (Best for: Text-in-image, typography, infographics)

**Key Strengths:**
- Excels at rendering readable text within images
- Best choice for data visualizations, quotes, branded content
- Handles typography placement precisely

**Prompt Structure:**
```
[Visual description]. [Text content to render: "exact text"]. [Typography style]. [Layout]. [Color scheme]. [Aspect ratio].
```

**Example:**
> Clean data visualization infographic showing a 30-day mood tracking chart. Text: "What's YOUR pattern?" in small sans-serif type at bottom. X-axis: days of week. Y-axis: mood score 1-10. Sage green for good days, coral for difficult days. Off-white background. Modern, professional aesthetic. 1:1 square aspect ratio.

### GPT Image (Best for: Versatile concepts, illustrations, creative direction)

**Key Strengths:**
- Most flexible generator for varied styles
- Good at interpreting natural language descriptions
- Strong at concept art, illustrations, mixed styles

**Prompt Structure:**
```
[Natural language description of the scene]. [Style direction]. [Mood and atmosphere]. [Color preferences]. [Composition notes].
```

**Example:**
> An overhead flat-lay on a light wooden surface featuring a leather journal, a clear glass of water, white sneakers, and a small green succulent plant. Warm morning sunlight casting soft shadows from the left. Clean, minimal aesthetic with natural textures. Warm earth tones dominate. Photography style, high resolution.

## Instagram Aspect Ratios

| Format | Ratio | Use Case |
|---|---|---|
| Feed (portrait) | 4:5 | Standard feed posts, maximum vertical real estate |
| Feed (square) | 1:1 | Grid consistency, older format |
| Stories/Reels | 9:16 | Full-screen vertical content |

**Always specify aspect ratio** in prompts — generators produce better results when aspect ratio is explicit.

## Brand Visual Vocabulary

When crafting image prompts, translate brand elements into visual language:

- **Brand colors** → Specific hex or descriptive color terms (e.g., "sage green #8B9E6B", "warm amber")
- **Brand tone** → Lighting and mood keywords (e.g., "warm, approachable" → "soft natural light, shallow depth of field")
- **Brand typography** → Font style descriptors (e.g., "clean sans-serif like Inter", "modern geometric type")
- **Brand aesthetic** → Style category (e.g., "minimal editorial", "vibrant lifestyle", "clean data-driven")

## Photography vs Illustration vs 3D Styles

### Photography Style
Best for: Lifestyle content, product shots, behind-the-scenes, testimonials
- Use Flux for photorealistic results
- Include camera details: lens type, depth of field, lighting setup
- Specify human subjects carefully: age, expression, clothing, posture

### Illustration Style  
Best for: Educational content, carousel infographics, explainer posts
- Use GPT Image for creative illustrations
- Specify illustration style: flat design, hand-drawn, watercolor, line art
- Include color palette and visual hierarchy

### 3D Render Style
Best for: Product mockups, abstract concepts, eye-catching feed posts
- Use Flux or GPT Image for 3D renders
- Specify materials: glass, metal, organic, soft
- Include lighting: studio lighting, environment lighting, dramatic shadows

### Graphic Design Style
Best for: Data visualization, branded content, quote posts
- Use Ideogram when text rendering is critical
- Specify layout: centered, left-aligned, grid
- Include typography details and spacing

## Composition Rules

1. **Rule of thirds** — Place subjects at intersection points for natural composition
2. **Negative space** — Leave breathing room for Instagram caption overlay or branded elements
3. **Mobile-first** — All images viewed on phone screens; ensure focal point is clearly visible at thumbnail size
4. **Grid coherence** — Consider how the image sits in the 3-column Instagram grid; maintain visual consistency
5. **Thumb-stop factor** — Image must stand out in a fast-scrolling feed; use contrast, color, or unusual composition
