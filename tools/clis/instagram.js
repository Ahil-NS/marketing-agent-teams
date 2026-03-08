#!/usr/bin/env node
'use strict';

// Instagram Graph API CLI - Zero-dependency Node.js script
// Requires: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID

const GRAPH_API = 'https://graph.facebook.com/v19.0';

const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const USER_ID = process.env.INSTAGRAM_USER_ID;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg, code = 1) {
  console.error(`Error: ${msg}`);
  process.exit(code);
}

function printUsage() {
  const bin = 'node instagram.js';
  console.log(`
Instagram Graph API CLI

Usage:
  ${bin} media list    [--limit <n>]
  ${bin} media create  --image-url <url> --caption <text>
  ${bin} media publish --creation-id <id>
  ${bin} user info
  ${bin} --help

Environment variables (required):
  INSTAGRAM_ACCESS_TOKEN   Instagram Graph API access token
  INSTAGRAM_USER_ID        Instagram business/creator account user ID

Notes:
  Media creation is a two-step process:
    1. "media create" creates a container (returns a creation ID)
    2. "media publish" publishes the container

Examples:
  ${bin} media list --limit 5
  ${bin} media create --image-url "https://example.com/photo.jpg" --caption "Great shot"
  ${bin} media publish --creation-id 17889234567890123
  ${bin} user info
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
  if (!ACCESS_TOKEN) die('INSTAGRAM_ACCESS_TOKEN is not set');
  if (!USER_ID) die('INSTAGRAM_USER_ID is not set');
}

// ---------------------------------------------------------------------------
// API request wrapper
// ---------------------------------------------------------------------------

async function graphRequest(method, path, params) {
  const url = new URL(`${GRAPH_API}${path}`);
  url.searchParams.set('access_token', ACCESS_TOKEN);

  const opts = {
    method,
    headers: {
      'User-Agent': 'marketing-agent-teams-cli/0.1.0',
    },
  };

  if (method === 'GET' && params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  if (method === 'POST' && params) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(params);
  }

  const res = await fetch(url.toString(), opts);

  // Rate limit awareness
  const appUsage = res.headers.get('x-app-usage');
  if (appUsage) {
    try {
      const usage = JSON.parse(appUsage);
      const callPct = usage.call_count || 0;
      if (callPct > 80) {
        console.error(`[rate-limit] App usage at ${callPct}%. Approaching rate limit.`);
      }
    } catch (_) {
      // ignore
    }
  }

  if (res.status === 429) {
    die('Rate limited by Instagram Graph API. Please wait and try again.');
  }

  const data = await res.json();

  if (data.error) {
    die(`Graph API error (${data.error.code}): ${data.error.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function mediaList(args) {
  const limit = args.limit || 10;

  const data = await graphRequest('GET', `/${USER_ID}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: String(limit),
  });

  const items = data?.data || [];

  if (items.length === 0) {
    console.log('No media found.');
    return;
  }

  console.log(`Media (${items.length}):\n`);
  for (const m of items) {
    const caption = m.caption ? m.caption.slice(0, 70) : '(no caption)';
    console.log(`  [${m.media_type}] ${caption}${m.caption && m.caption.length > 70 ? '...' : ''}`);
    console.log(`    id: ${m.id}  posted: ${m.timestamp}`);
    console.log(`    likes: ${m.like_count || 0}  comments: ${m.comments_count || 0}`);
    console.log(`    permalink: ${m.permalink || '(none)'}`);
    console.log();
  }

  if (data?.paging?.next) {
    console.log('More media available via pagination.');
  }
}

async function mediaCreate(args) {
  const imageUrl = args['image-url'];
  const caption = args.caption;

  if (!imageUrl) die('--image-url is required');
  if (!caption) die('--caption is required');

  // Step 1: Create media container
  const data = await graphRequest('POST', `/${USER_ID}/media`, {
    image_url: imageUrl,
    caption,
  });

  if (!data.id) {
    die('Failed to create media container. No ID returned.');
  }

  console.log('Media container created successfully.');
  console.log(`  Creation ID: ${data.id}`);
  console.log();
  console.log('To publish this media, run:');
  console.log(`  node instagram.js media publish --creation-id ${data.id}`);
}

async function mediaPublish(args) {
  const creationId = args['creation-id'];
  if (!creationId) die('--creation-id is required');

  // Step 2: Publish the container
  const data = await graphRequest('POST', `/${USER_ID}/media_publish`, {
    creation_id: creationId,
  });

  if (!data.id) {
    die('Failed to publish media. No ID returned.');
  }

  console.log('Media published successfully.');
  console.log(`  Media ID: ${data.id}`);
}

async function userInfo() {
  const data = await graphRequest('GET', `/${USER_ID}`, {
    fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
  });

  console.log('User Info:');
  console.log(`  ID:              ${data.id}`);
  console.log(`  Username:        ${data.username || '(unknown)'}`);
  console.log(`  Name:            ${data.name || '(unknown)'}`);
  console.log(`  Bio:             ${data.biography || '(none)'}`);
  console.log(`  Followers:       ${data.followers_count || 0}`);
  console.log(`  Following:       ${data.follows_count || 0}`);
  console.log(`  Media Count:     ${data.media_count || 0}`);
  console.log(`  Website:         ${data.website || '(none)'}`);
  if (data.profile_picture_url) {
    console.log(`  Profile Picture: ${data.profile_picture_url}`);
  }
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

  if (resource === 'media' && action === 'list') {
    await mediaList(args);
  } else if (resource === 'media' && action === 'create') {
    await mediaCreate(args);
  } else if (resource === 'media' && action === 'publish') {
    await mediaPublish(args);
  } else if (resource === 'user' && action === 'info') {
    await userInfo();
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
