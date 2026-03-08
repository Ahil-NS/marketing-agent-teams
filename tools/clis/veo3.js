#!/usr/bin/env node
'use strict';

// Veo 3 Video Generation CLI - Zero-dependency Node.js script
// Requires: GOOGLE_AI_API_KEY
//
// Usage:
//   node veo3.js generate --prompt "..." [--aspect-ratio 9:16] [--duration 8] [--output ./video.mp4]
//   node veo3.js status --operation <operation-name>
//   node veo3.js download --uri <video-uri> --output ./video.mp4

import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'veo-3.0-generate-001';
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 120;

const API_KEY = process.env.GOOGLE_AI_API_KEY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg, code = 1) {
  console.error(`Error: ${msg}`);
  process.exit(code);
}

function printUsage() {
  const bin = 'node veo3.js';
  console.log(`
Veo 3 Video Generation CLI

Usage:
  ${bin} generate --prompt "..." [options]
  ${bin} status   --operation <name>
  ${bin} download --uri <video-uri> --output <path>
  ${bin} --help

Options for generate:
  --prompt <text>          Video generation prompt (required)
  --aspect-ratio <ratio>   16:9 or 9:16 (default: 9:16)
  --duration <seconds>     4, 6, or 8 (default: 8)
  --resolution <res>       720p or 1080p (default: 720p)
  --output <path>          Download video to this path after generation
  --model <model>          Model ID (default: ${DEFAULT_MODEL})
  --no-wait                Start generation without waiting for completion

Environment variables (required):
  GOOGLE_AI_API_KEY        Google AI / Gemini API key

Examples:
  ${bin} generate --prompt "A cinematic shot of a laptop on a desk" --output video.mp4
  ${bin} generate --prompt "Product demo in a modern office" --aspect-ratio 9:16 --duration 8
  ${bin} status --operation operations/abc123
  ${bin} download --uri "https://..." --output ./video.mp4
`.trim());
}

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (a === '--no-wait') {
      args['no-wait'] = true;
    } else if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, args };
}

function requireEnv() {
  if (!API_KEY) die('GOOGLE_AI_API_KEY is not set. Get one from https://aistudio.google.com/apikey');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function startGeneration(prompt, params, model) {
  const url = `${GEMINI_API_BASE}/models/${model}:predictLongRunning`;

  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio: params.aspectRatio || '9:16',
      durationSeconds: String(params.duration || '8'),
      resolution: params.resolution || '720p',
      personGeneration: 'allow_adult',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    die(`Veo 3 API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.name) {
    die('Veo 3 API did not return an operation name');
  }

  return data.name;
}

async function pollOperation(operationName) {
  const url = `${GEMINI_API_BASE}/${operationName}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-goog-api-key': API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    die(`Poll error (${res.status}): ${text}`);
  }

  return res.json();
}

function extractVideoUri(result) {
  const resp = result.response;
  if (!resp) return null;

  // generateVideoResponse format
  if (resp.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
    return resp.generateVideoResponse.generatedSamples[0].video.uri;
  }

  // generatedVideos format (newer API)
  if (resp.generatedVideos?.[0]?.video?.uri) {
    return resp.generatedVideos[0].video.uri;
  }

  return null;
}

async function downloadVideo(videoUri, outputPath) {
  const separator = videoUri.includes('?') ? '&' : '?';
  const url = `${videoUri}${separator}key=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    die(`Download failed (${res.status}): ${res.statusText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(outputPath, buffer);
  return outputPath;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdGenerate(args) {
  const prompt = args.prompt;
  if (!prompt) die('--prompt is required');

  const model = args.model || DEFAULT_MODEL;
  const params = {
    aspectRatio: args['aspect-ratio'] || '9:16',
    duration: args.duration || '8',
    resolution: args.resolution || '720p',
  };

  console.log(`Starting Veo 3 video generation...`);
  console.log(`  Model:        ${model}`);
  console.log(`  Aspect Ratio: ${params.aspectRatio}`);
  console.log(`  Duration:     ${params.duration}s`);
  console.log(`  Resolution:   ${params.resolution}`);
  console.log(`  Prompt:       ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`);

  const operationName = await startGeneration(prompt, params, model);
  console.log(`\nOperation started: ${operationName}`);

  if (args['no-wait']) {
    console.log(JSON.stringify({ status: 'started', operationName }));
    return;
  }

  // Poll until done
  console.log('Waiting for video generation...');
  let attempts = 0;
  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    await sleep(POLL_INTERVAL_MS);

    const result = await pollOperation(operationName);

    if (result.done) {
      if (result.error) {
        die(`Generation failed: ${result.error.message}`);
      }

      const videoUri = extractVideoUri(result);
      if (!videoUri) {
        die('Generation completed but no video URI found');
      }

      console.log(`\nVideo generated successfully!`);
      console.log(`  URI: ${videoUri}`);

      // Download if --output specified
      if (args.output) {
        const outputPath = resolve(args.output);
        console.log(`  Downloading to: ${outputPath}`);
        await downloadVideo(videoUri, outputPath);
        console.log(`  Downloaded: ${outputPath}`);
        console.log(JSON.stringify({
          status: 'completed',
          operationName,
          videoUri,
          localPath: outputPath,
          duration: params.duration,
          model,
        }));
      } else {
        console.log(JSON.stringify({
          status: 'completed',
          operationName,
          videoUri,
          duration: params.duration,
          model,
        }));
      }

      return;
    }

    const elapsed = (attempts * POLL_INTERVAL_MS / 1000).toFixed(0);
    process.stderr.write(`  [${elapsed}s] Still generating...\r`);
  }

  die(`Generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

async function cmdStatus(args) {
  const operationName = args.operation;
  if (!operationName) die('--operation is required');

  const result = await pollOperation(operationName);

  if (result.done) {
    if (result.error) {
      console.log(`Status: FAILED`);
      console.log(`  Error: ${result.error.message}`);
    } else {
      const videoUri = extractVideoUri(result);
      console.log(`Status: COMPLETED`);
      console.log(`  Video URI: ${videoUri || '(not found)'}`);
    }
  } else {
    console.log(`Status: GENERATING`);
    console.log(`  Operation: ${operationName}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

async function cmdDownload(args) {
  const uri = args.uri;
  const output = args.output;
  if (!uri) die('--uri is required');
  if (!output) die('--output is required');

  const outputPath = resolve(output);
  console.log(`Downloading video to: ${outputPath}`);
  await downloadVideo(uri, outputPath);
  console.log(`Downloaded: ${outputPath}`);
  console.log(JSON.stringify({ status: 'downloaded', localPath: outputPath }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { positional, args } = parseArgs(process.argv.slice(2));

  if (args.help || positional.length === 0) {
    printUsage();
    process.exit(0);
  }

  requireEnv();

  const command = positional[0];

  if (command === 'generate') {
    await cmdGenerate(args);
  } else if (command === 'status') {
    await cmdStatus(args);
  } else if (command === 'download') {
    await cmdDownload(args);
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
