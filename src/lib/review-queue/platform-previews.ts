/**
 * Platform-specific content preview renderers.
 * Renders ReviewItem content as a formatted CLI preview for each target platform.
 * No external API calls — uses stored content data only.
 */

import type {ReviewItem} from './types.js'

const BOX_WIDTH = 55
const TOP_LEFT = '┌'
const TOP_RIGHT = '┐'
const BOTTOM_LEFT = '└'
const BOTTOM_RIGHT = '┘'
const HORIZONTAL = '─'
const VERTICAL = '│'

/** Build a box top border with title */
function boxTop(title: string): string {
  const inner = ` ${title} `
  const remaining = BOX_WIDTH - inner.length - 2
  return `${TOP_LEFT}${HORIZONTAL}${inner}${HORIZONTAL.repeat(Math.max(0, remaining))}${TOP_RIGHT}`
}

/** Build a box bottom border */
function boxBottom(): string {
  return `${BOTTOM_LEFT}${HORIZONTAL.repeat(BOX_WIDTH)}${BOTTOM_RIGHT}`
}

/** Build a box line with content padded to width */
function boxLine(text: string): string {
  const trimmed = text.slice(0, BOX_WIDTH - 2)
  const padding = Math.max(0, BOX_WIDTH - 2 - trimmed.length)
  return `${VERTICAL} ${trimmed}${' '.repeat(padding)}${VERTICAL}`
}

/** Build an empty box line */
function boxEmpty(): string {
  return `${VERTICAL}${' '.repeat(BOX_WIDTH)}${VERTICAL}`
}

/** Safely get a string from platformMeta */
function metaStr(meta: Record<string, unknown>, key: string): string | undefined {
  const val = meta[key]
  return typeof val === 'string' ? val : undefined
}

/**
 * Render a platform-specific preview for a review item.
 * Dispatches to the appropriate renderer based on item.platform.
 */
export function renderPlatformPreview(item: ReviewItem): string {
  switch (item.platform) {
    case 'reddit': {
      return renderRedditPreview(item)
    }

    case 'tiktok': {
      return renderTikTokPreview(item)
    }

    case 'instagram': {
      return renderInstagramPreview(item)
    }

    case 'facebook': {
      return renderFacebookPreview(item)
    }

    default: {
      return renderGenericPreview(item)
    }
  }
}

/**
 * Reddit preview: title, body, first comment, subreddit/flair context.
 */
export function renderRedditPreview(item: ReviewItem): string {
  const {content} = item
  const meta = content.platformMeta
  const subreddit = metaStr(meta, 'subreddit')
  const flair = metaStr(meta, 'flair')
  const firstComment = metaStr(meta, 'firstComment')

  const lines: string[] = []
  lines.push(boxTop('Reddit Preview'))

  // Subreddit and flair line
  if (subreddit) {
    const context = flair ? `${subreddit} \u2022 ${flair}` : subreddit
    lines.push(boxLine(context))
  }

  lines.push(boxEmpty())

  // Title
  if (content.title) {
    lines.push(boxLine(content.title))
    lines.push(boxEmpty())
  }

  // Body
  if (content.body) {
    for (const bodyLine of wrapText(content.body, BOX_WIDTH - 4)) {
      lines.push(boxLine(bodyLine))
    }
  }

  // First comment
  if (firstComment) {
    lines.push(boxEmpty())
    lines.push(boxLine('\uD83D\uDCAC First Comment:'))
    for (const commentLine of wrapText(firstComment, BOX_WIDTH - 4)) {
      lines.push(boxLine(commentLine))
    }
  }

  lines.push(boxBottom())
  return lines.join('\n')
}

/**
 * TikTok preview: caption (char count), hashtags, SEO layers, video prompt.
 */
export function renderTikTokPreview(item: ReviewItem): string {
  const {content} = item
  const meta = content.platformMeta
  const videoPrompt = metaStr(meta, 'videoPrompt')
  const seoLayers = meta.seoLayers as {caption?: string[]; audio?: string; textOverlay?: string; hashtag?: string[]} | undefined

  const lines: string[] = []
  lines.push(boxTop('TikTok Preview'))

  // Caption with char count
  const captionLen = content.body.length
  lines.push(boxLine(`\uD83D\uDCF1 Caption (${captionLen}/300 chars):`))
  for (const capLine of wrapText(content.body, BOX_WIDTH - 4)) {
    lines.push(boxLine(capLine))
  }

  // Hashtags
  if (content.hashtags && content.hashtags.length > 0) {
    lines.push(boxEmpty())
    lines.push(boxLine(`# Hashtags: ${content.hashtags.join(' ')}`))
  }

  // Video prompt
  if (videoPrompt) {
    lines.push(boxEmpty())
    lines.push(boxLine('\uD83C\uDFAC Video Prompt:'))
    for (const promptLine of wrapText(videoPrompt, BOX_WIDTH - 4)) {
      lines.push(boxLine(promptLine))
    }
  }

  // SEO Layers
  if (seoLayers) {
    lines.push(boxEmpty())
    lines.push(boxLine('\uD83D\uDCCA SEO Layers:'))
    if (seoLayers.caption && seoLayers.caption.length > 0) {
      lines.push(boxLine(`  \u2022 Caption SEO: ${seoLayers.caption.join(', ')}`))
    }

    if (seoLayers.audio) {
      lines.push(boxLine(`  \u2022 Audio: ${seoLayers.audio}`))
    }

    if (seoLayers.textOverlay) {
      lines.push(boxLine(`  \u2022 Text overlay: ${seoLayers.textOverlay}`))
    }

    if (seoLayers.hashtag && seoLayers.hashtag.length > 0) {
      lines.push(boxLine(`  \u2022 Hashtag SEO: ${seoLayers.hashtag.join(', ')}`))
    }
  }

  lines.push(boxBottom())
  return lines.join('\n')
}

/**
 * Instagram preview: caption (char count), hashtags, carousel structure, image prompt.
 */
export function renderInstagramPreview(item: ReviewItem): string {
  const {content} = item
  const meta = content.platformMeta
  const imagePrompt = metaStr(meta, 'imagePrompt') ?? metaStr(meta, 'coverImagePrompt')
  const carouselSlides = meta.carouselSlides

  const lines: string[] = []
  lines.push(boxTop('Instagram Preview'))

  // Caption with char count
  const captionLen = content.body.length
  lines.push(boxLine(`\uD83D\uDCF8 Caption (${captionLen}/2200 chars):`))
  for (const capLine of wrapText(content.body, BOX_WIDTH - 4)) {
    lines.push(boxLine(capLine))
  }

  // Hashtags with count/30
  if (content.hashtags && content.hashtags.length > 0) {
    lines.push(boxEmpty())
    lines.push(boxLine(`# Hashtags (${content.hashtags.length}/30): ${content.hashtags.join(' ')}`))
  }

  // Carousel slides
  if (carouselSlides) {
    lines.push(boxEmpty())
    if (Array.isArray(carouselSlides)) {
      lines.push(boxLine(`\uD83D\uDDBC\uFE0F  Carousel (${carouselSlides.length} slides):`))
      for (const slide of carouselSlides as Array<{index: number; description: string}>) {
        lines.push(boxLine(`  [${slide.index}] ${slide.description}`))
      }
    } else if (typeof carouselSlides === 'number') {
      lines.push(boxLine(`\uD83D\uDDBC\uFE0F  Carousel (${carouselSlides} slides)`))
    }
  }

  // Image prompt
  if (imagePrompt) {
    lines.push(boxEmpty())
    lines.push(boxLine('\uD83C\uDFA8 Image Prompt:'))
    for (const promptLine of wrapText(imagePrompt, BOX_WIDTH - 4)) {
      lines.push(boxLine(promptLine))
    }
  }

  lines.push(boxBottom())
  return lines.join('\n')
}

/**
 * Facebook preview: post text, hashtags, engagement prompt.
 */
export function renderFacebookPreview(item: ReviewItem): string {
  const {content} = item
  const meta = content.platformMeta
  const engagementPrompt = metaStr(meta, 'engagementPrompt')

  const lines: string[] = []
  lines.push(boxTop('Facebook Preview'))

  // Post text
  lines.push(boxLine('\uD83D\uDCD8 Post:'))
  for (const bodyLine of wrapText(content.body, BOX_WIDTH - 4)) {
    lines.push(boxLine(bodyLine))
  }

  // Hashtags
  if (content.hashtags && content.hashtags.length > 0) {
    lines.push(boxEmpty())
    lines.push(boxLine(`# Hashtags: ${content.hashtags.join(' ')}`))
  }

  // Engagement prompt
  if (engagementPrompt) {
    lines.push(boxEmpty())
    lines.push(boxLine('\uD83D\uDCAC Engagement Prompt:'))
    for (const promptLine of wrapText(engagementPrompt, BOX_WIDTH - 4)) {
      lines.push(boxLine(promptLine))
    }
  }

  lines.push(boxBottom())
  return lines.join('\n')
}

/** Generic fallback for unknown platforms */
function renderGenericPreview(item: ReviewItem): string {
  const lines: string[] = []
  lines.push(boxTop(`${item.platform} Preview`))

  if (item.content.title) {
    lines.push(boxLine(item.content.title))
    lines.push(boxEmpty())
  }

  for (const bodyLine of wrapText(item.content.body, BOX_WIDTH - 4)) {
    lines.push(boxLine(bodyLine))
  }

  lines.push(boxBottom())
  return lines.join('\n')
}

/** Simple word-wrapping for text to fit within maxWidth */
function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return ['']
  const paragraphs = text.split('\n')
  const result: string[] = []

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxWidth) {
      result.push(paragraph)
      continue
    }

    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += ' ' + word
      } else {
        result.push(currentLine)
        currentLine = word
      }
    }

    if (currentLine.length > 0) {
      result.push(currentLine)
    }
  }

  return result.length > 0 ? result : ['']
}
