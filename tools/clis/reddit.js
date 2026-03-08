#!/usr/bin/env node
'use strict';

// Reddit API CLI - Zero-dependency Node.js script
// Requires: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN

const REDDIT_API = 'https://oauth.reddit.com';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REDDIT_REFRESH_TOKEN;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg, code = 1) {
  console.error(`Error: ${msg}`);
  process.exit(code);
}

function printUsage() {
  const bin = 'node reddit.js';
  console.log(`
Reddit API CLI

Usage:
  ${bin} post submit --subreddit <sub> --title <title> --text <body>
  ${bin} post list   --subreddit <sub> [--limit <n>]
  ${bin} comment add --thing-id <id> --text <body>
  ${bin} --help

Environment variables (required):
  REDDIT_CLIENT_ID        OAuth2 client id
  REDDIT_CLIENT_SECRET    OAuth2 client secret
  REDDIT_REFRESH_TOKEN    OAuth2 refresh token

Examples:
  ${bin} post submit --subreddit test --title "Hello" --text "World"
  ${bin} post list --subreddit javascript --limit 5
  ${bin} comment add --thing-id t3_abc123 --text "Great post!"
`.trim());
}

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
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
  if (!CLIENT_ID) die('REDDIT_CLIENT_ID is not set');
  if (!CLIENT_SECRET) die('REDDIT_CLIENT_SECRET is not set');
  if (!REFRESH_TOKEN) die('REDDIT_REFRESH_TOKEN is not set');
}

// ---------------------------------------------------------------------------
// Auth - obtain a fresh access token using the refresh token
// ---------------------------------------------------------------------------

let cachedToken = null;

async function getAccessToken() {
  if (cachedToken) return cachedToken;

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'marketing-agent-teams-cli/0.1.0',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    die(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  return cachedToken;
}

// ---------------------------------------------------------------------------
// API request wrapper with rate-limit handling
// ---------------------------------------------------------------------------

async function redditRequest(method, path, payload) {
  const token = await getAccessToken();
  const url = `${REDDIT_API}${path}`;

  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'marketing-agent-teams-cli/0.1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (payload && (method === 'POST' || method === 'PUT')) {
    opts.body = new URLSearchParams(payload).toString();
  }

  const res = await fetch(url, opts);

  // Rate limit awareness
  const remaining = res.headers.get('x-ratelimit-remaining');
  const resetSec = res.headers.get('x-ratelimit-reset');
  if (remaining !== null && Number(remaining) < 5) {
    const wait = Math.ceil(Number(resetSec) || 10);
    console.error(`[rate-limit] Only ${remaining} requests remaining. Resets in ${wait}s.`);
  }

  if (res.status === 429) {
    const wait = Math.ceil(Number(resetSec) || 60);
    die(`Rate limited by Reddit. Try again in ${wait} seconds.`);
  }

  if (!res.ok) {
    const text = await res.text();
    die(`Reddit API error (${res.status}): ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function postSubmit(args) {
  const subreddit = args.subreddit;
  const title = args.title;
  const text = args.text || '';
  if (!subreddit) die('--subreddit is required');
  if (!title) die('--title is required');

  const data = await redditRequest('POST', '/api/submit', {
    sr: subreddit,
    kind: 'self',
    title,
    text,
    api_type: 'json',
  });

  const result = data?.json;
  if (result?.errors?.length) {
    die(`Submit failed: ${JSON.stringify(result.errors)}`);
  }

  const postUrl = result?.data?.url || '(unknown)';
  const postId = result?.data?.name || '(unknown)';
  console.log(`Post submitted successfully.`);
  console.log(`  ID:  ${postId}`);
  console.log(`  URL: ${postUrl}`);
}

async function postList(args) {
  const subreddit = args.subreddit;
  if (!subreddit) die('--subreddit is required');
  const limit = args.limit || 10;

  const data = await redditRequest('GET', `/r/${subreddit}/hot.json?limit=${limit}`);
  const posts = data?.data?.children || [];

  if (posts.length === 0) {
    console.log('No posts found.');
    return;
  }

  console.log(`Top ${posts.length} posts in r/${subreddit}:\n`);
  for (const child of posts) {
    const p = child.data;
    console.log(`  [${p.score}] ${p.title}`);
    console.log(`    id: ${p.name}  comments: ${p.num_comments}  author: u/${p.author}`);
    console.log();
  }
}

async function commentAdd(args) {
  const thingId = args['thing-id'];
  const text = args.text;
  if (!thingId) die('--thing-id is required (e.g. t3_abc123 or t1_xyz789)');
  if (!text) die('--text is required');

  const data = await redditRequest('POST', '/api/comment', {
    thing_id: thingId,
    text,
    api_type: 'json',
  });

  const result = data?.json;
  if (result?.errors?.length) {
    die(`Comment failed: ${JSON.stringify(result.errors)}`);
  }

  const things = result?.data?.things || [];
  const commentId = things[0]?.data?.name || '(unknown)';
  console.log(`Comment posted successfully.`);
  console.log(`  ID: ${commentId}`);
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

  const resource = positional[0];
  const action = positional[1];

  if (resource === 'post' && action === 'submit') {
    await postSubmit(args);
  } else if (resource === 'post' && action === 'list') {
    await postList(args);
  } else if (resource === 'comment' && action === 'add') {
    await commentAdd(args);
  } else {
    console.error(`Unknown command: ${positional.join(' ')}`);
    printUsage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
