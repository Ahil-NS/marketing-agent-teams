/**
 * Veo 3 Video Generation Client
 *
 * Uses the Google Gemini API to generate videos from text prompts.
 * Requires GOOGLE_AI_API_KEY environment variable.
 *
 * API Reference: https://ai.google.dev/gemini-api/docs/video
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'veo-3.0-generate-001'
const POLL_INTERVAL_MS = 10_000
const MAX_POLL_ATTEMPTS = 120 // 20 minutes max

export interface Veo3Config {
  apiKey: string
  model?: string
  aspectRatio?: '16:9' | '9:16'
  durationSeconds?: '4' | '6' | '8'
  resolution?: '720p' | '1080p'
  personGeneration?: 'allow_all' | 'allow_adult'
}

export interface Veo3GenerateResult {
  operationName: string
  videoUri: string
  localPath?: string
  durationSeconds: number
  model: string
}

export interface Veo3Error {
  code: string
  message: string
}

export class Veo3Client {
  private readonly apiKey: string
  private readonly model: string

  constructor(config: Veo3Config) {
    this.apiKey = config.apiKey
    this.model = config.model ?? DEFAULT_MODEL
  }

  /**
   * Generate a video from a text prompt. Polls until completion.
   * Returns the video URI and metadata.
   */
  async generateVideo(
    prompt: string,
    options?: {
      aspectRatio?: '16:9' | '9:16'
      durationSeconds?: '4' | '6' | '8'
      resolution?: '720p' | '1080p'
      personGeneration?: 'allow_all' | 'allow_adult'
      onProgress?: (status: string, attempt: number) => void
    },
  ): Promise<Veo3GenerateResult> {
    const aspectRatio = options?.aspectRatio ?? '9:16' // TikTok vertical
    const durationSeconds = options?.durationSeconds ?? '8'
    const resolution = options?.resolution ?? '720p'
    const personGeneration = options?.personGeneration ?? 'allow_adult'

    // Step 1: Start the generation operation
    const operationName = await this.startGeneration(prompt, {
      aspectRatio,
      durationSeconds,
      resolution,
      personGeneration,
    })

    options?.onProgress?.('started', 0)

    // Step 2: Poll until done
    let attempts = 0
    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts++
      await sleep(POLL_INTERVAL_MS)

      const result = await this.pollOperation(operationName)
      options?.onProgress?.(result.done ? 'completed' : 'generating', attempts)

      if (result.done) {
        if (result.error) {
          throw new Error(`Veo3 generation failed: ${result.error.message}`)
        }

        const videoUri = this.extractVideoUri(result)
        if (!videoUri) {
          throw new Error('Veo3 generation completed but no video URI found in response')
        }

        return {
          operationName,
          videoUri,
          durationSeconds: parseInt(durationSeconds, 10),
          model: this.model,
        }
      }
    }

    throw new Error(`Veo3 generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`)
  }

  /**
   * Download a generated video to a local file path.
   */
  async downloadVideo(videoUri: string, outputPath: string): Promise<string> {
    const {writeFile} = await import('node:fs/promises')

    const separator = videoUri.includes('?') ? '&' : '?'
    const url = `${videoUri}${separator}key=${this.apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(outputPath, buffer)

    return outputPath
  }

  // --- Private helpers ---

  private async startGeneration(
    prompt: string,
    params: {
      aspectRatio: string
      durationSeconds: string
      resolution: string
      personGeneration: string
    },
  ): Promise<string> {
    const url = `${GEMINI_API_BASE}/models/${this.model}:predictLongRunning`

    const body = {
      instances: [{prompt}],
      parameters: {
        aspectRatio: params.aspectRatio,
        durationSeconds: params.durationSeconds,
        resolution: params.resolution,
        personGeneration: params.personGeneration,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Veo3 API error (${response.status}): ${text}`)
    }

    const data = await response.json() as {name?: string}
    if (!data.name) {
      throw new Error('Veo3 API did not return an operation name')
    }

    return data.name
  }

  private async pollOperation(operationName: string): Promise<{
    done: boolean
    error?: Veo3Error
    response?: unknown
  }> {
    const url = `${GEMINI_API_BASE}/${operationName}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Veo3 poll error (${response.status}): ${text}`)
    }

    return await response.json() as {done: boolean; error?: Veo3Error; response?: unknown}
  }

  private extractVideoUri(result: {response?: unknown}): string | null {
    const resp = result.response as Record<string, unknown> | undefined
    if (!resp) return null

    // Try generateVideoResponse format
    const genResp = resp.generateVideoResponse as {
      generatedSamples?: Array<{video?: {uri?: string}}>
    } | undefined
    if (genResp?.generatedSamples?.[0]?.video?.uri) {
      return genResp.generatedSamples[0].video.uri
    }

    // Try generatedVideos format (newer API)
    const genVideos = resp.generatedVideos as Array<{video?: {uri?: string}}> | undefined
    if (genVideos?.[0]?.video?.uri) {
      return genVideos[0].video.uri
    }

    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
