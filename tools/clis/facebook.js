#!/usr/bin/env node
'use strict';

// Facebook Graph API CLI - Zero-dependency Node.js script
// Requires: FACEBOOK_ACCESS_TOKEN, FACEBOOK_PAGE_ID

const GRAPH_API = 'https://graph.facebook.com/v19.0';

const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const PAGE_ID = process.env.FACEBOOK_PAGE_ID;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg, code = 1) {
  console.error(`Error: ${msg}`);
  process.exit(code);
}

function printUsage() {
  const bin = 'node facebook.js';
  console.log(`
Facebook Graph API CLI

Usage:
  ${bin} post create  --message <text> [--link <url>]
  ${bin} post list    [--limit <n>]
  ${bin} post delete  --post-id <id>
  ${bin} page info
  ${bin} --help

Environment variables (required):
  FACEBOOK_ACCESS_TOKEN   Page access token
  FACEBOOK_PAGE_ID        Facebook page ID

Examples:
  ${bin} post create --message "Hello from the CLI!"
  ${bin} post create --message "Check this out" --link "https://example.com"
  ${bin} post list --limit 5
  ${bin} page info
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
  if (!ACCESS_TOKEN) die('FACEBOOK_ACCESS_TOKEN is not set');
  if (!PAGE_ID) die('FACEBOOK_PAGE_ID is not set');
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

  if ((method === 'POST' || method === 'DELETE') && params) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(params);
  }

  const res = await fetch(url.toString(), opts);

  // Rate limit awareness via headers
  const appUsage = res.headers.get('x-app-usage');
  if (appUsage) {
    try {
      const usage = JSON.parse(appUsage);
      const callPct = usage.call_count || 0;
      if (callPct > 80) {
        console.error(`[rate-limit] App usage at ${callPct}%. Approaching rate limit.`);
      }
    } catch (_) {
      // ignore parse errors on usage header
    }
  }

  if (res.status === 429) {
    die('Rate limited by Facebook Graph API. Please wait and try again.');
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

async function postCreate(args) {
  const message = args.message;
  if (!message) die('--message is required');

  const payload = { message };
  if (args.link) {
    payload.link = args.link;
  }

  const data = await graphRequest('POST', `/${PAGE_ID}/feed`, payload);

  console.log('Post created successfully.');
  console.log(`  ID: ${data.id}`);
}

async function postList(args) {
  const limit = args.limit || 10;

  const data = await graphRequest('GET', `/${PAGE_ID}/feed`, {
    fields: 'id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)',
    limit: String(limit),
  });

  const posts = data?.data || [];

  if (posts.length === 0) {
    console.log('No posts found.');
    return;
  }

  console.log(`Posts (${posts.length}):\n`);
  for (const p of posts) {
    const msg = p.message ? p.message.slice(0, 80) : '(no text)';
    const likes = p.likes?.summary?.total_count || 0;
    const comments = p.comments?.summary?.total_count || 0;
    const shares = p.shares?.count || 0;

    console.log(`  ${msg}${p.message && p.message.length > 80 ? '...' : ''}`);
    console.log(`    id: ${p.id}  created: ${p.created_time}`);
    console.log(`    likes: ${likes}  comments: ${comments}  shares: ${shares}`);
    if (p.permalink_url) {
      console.log(`    url: ${p.permalink_url}`);
    }
    console.log();
  }

  if (data?.paging?.next) {
    console.log('More posts available. Use the Graph API cursor for pagination.');
  }
}

async function postDelete(args) {
  const postId = args['post-id'];
  if (!postId) die('--post-id is required');

  await graphRequest('DELETE', `/${postId}`, {});

  console.log(`Post ${postId} deleted successfully.`);
}

async function pageInfo() {
  const data = await graphRequest('GET', `/${PAGE_ID}`, {
    fields: 'id,name,about,category,fan_count,followers_count,website,link,verification_status',
  });

  console.log('Page Info:');
  console.log(`  ID:           ${data.id}`);
  console.log(`  Name:         ${data.name || '(unknown)'}`);
  console.log(`  Category:     ${data.category || '(none)'}`);
  console.log(`  About:        ${data.about || '(none)'}`);
  console.log(`  Fans:         ${data.fan_count || 0}`);
  console.log(`  Followers:    ${data.followers_count || 0}`);
  console.log(`  Website:      ${data.website || '(none)'}`);
  console.log(`  Link:         ${data.link || '(none)'}`);
  console.log(`  Verified:     ${data.verification_status || '(unknown)'}`);
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

  if (resource === 'post' && action === 'create') {
    await postCreate(args);
  } else if (resource === 'post' && action === 'list') {
    await postList(args);
  } else if (resource === 'post' && action === 'delete') {
    await postDelete(args);
  } else if (resource === 'page' && action === 'info') {
    await pageInfo();
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
