#!/usr/bin/env node
'use strict';

// TikTok API CLI - Zero-dependency Node.js script
// Requires: TIKTOK_ACCESS_TOKEN

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg, code = 1) {
  console.error(`Error: ${msg}`);
  process.exit(code);
}

function printUsage() {
  const bin = 'node tiktok.js';
  console.log(`
TikTok API CLI

Usage:
  ${bin} video info   --video-id <id>
  ${bin} video list   [--cursor <cursor>] [--max-count <n>]
  ${bin} user info
  ${bin} video publish-status --publish-id <id>
  ${bin} --help

Environment variables (required):
  TIKTOK_ACCESS_TOKEN    OAuth2 access token

Examples:
  ${bin} video list --max-count 5
  ${bin} video info --video-id 7123456789012345678
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
  if (!ACCESS_TOKEN) die('TIKTOK_ACCESS_TOKEN is not set');
}

// ---------------------------------------------------------------------------
// API request wrapper
// ---------------------------------------------------------------------------

async function tiktokRequest(method, path, body) {
  const url = `${TIKTOK_API}${path}`;

  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);

  // Rate limit awareness
  const remaining = res.headers.get('x-ratelimit-remaining');
  const resetTs = res.headers.get('x-ratelimit-reset');
  if (remaining !== null && Number(remaining) < 5) {
    const resetDate = resetTs ? new Date(Number(resetTs) * 1000).toISOString() : 'soon';
    console.error(`[rate-limit] Only ${remaining} requests remaining. Resets at ${resetDate}.`);
  }

  if (res.status === 429) {
    die('Rate limited by TikTok. Please wait and try again.');
  }

  if (!res.ok) {
    const text = await res.text();
    die(`TikTok API error (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (data.error && data.error.code !== 'ok') {
    die(`TikTok API error: ${data.error.code} - ${data.error.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function videoInfo(args) {
  const videoId = args['video-id'];
  if (!videoId) die('--video-id is required');

  const data = await tiktokRequest('POST', '/video/query/', {
    filters: {
      video_ids: [videoId],
    },
    fields: [
      'id', 'title', 'create_time', 'cover_image_url',
      'share_url', 'video_description', 'duration',
      'like_count', 'comment_count', 'share_count', 'view_count',
    ],
  });

  const videos = data?.data?.videos || [];
  if (videos.length === 0) {
    console.log('Video not found.');
    return;
  }

  const v = videos[0];
  console.log('Video Details:');
  console.log(`  ID:          ${v.id}`);
  console.log(`  Title:       ${v.title || '(none)'}`);
  console.log(`  Description: ${v.video_description || '(none)'}`);
  console.log(`  Duration:    ${v.duration}s`);
  console.log(`  Created:     ${new Date(v.create_time * 1000).toISOString()}`);
  console.log(`  Views:       ${v.view_count}`);
  console.log(`  Likes:       ${v.like_count}`);
  console.log(`  Comments:    ${v.comment_count}`);
  console.log(`  Shares:      ${v.share_count}`);
  console.log(`  URL:         ${v.share_url}`);
}

async function videoList(args) {
  const maxCount = Number(args['max-count']) || 20;
  const cursor = args.cursor ? Number(args.cursor) : undefined;

  const body = {
    max_count: Math.min(maxCount, 20),
    fields: [
      'id', 'title', 'create_time', 'video_description',
      'like_count', 'comment_count', 'view_count',
    ],
  };
  if (cursor !== undefined) {
    body.cursor = cursor;
  }

  const data = await tiktokRequest('POST', '/video/list/', body);
  const videos = data?.data?.videos || [];

  if (videos.length === 0) {
    console.log('No videos found.');
    return;
  }

  console.log(`Videos (${videos.length}):\n`);
  for (const v of videos) {
    console.log(`  [${v.view_count || 0} views] ${v.title || v.video_description || '(untitled)'}`);
    console.log(`    id: ${v.id}  likes: ${v.like_count || 0}  comments: ${v.comment_count || 0}`);
    console.log(`    created: ${new Date(v.create_time * 1000).toISOString()}`);
    console.log();
  }

  if (data?.data?.has_more) {
    console.log(`More results available. Use --cursor ${data.data.cursor} to fetch next page.`);
  }
}

async function userInfo() {
  const data = await tiktokRequest('GET', '/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count');

  const u = data?.data?.user || {};
  console.log('User Info:');
  console.log(`  Display Name: ${u.display_name || '(unknown)'}`);
  console.log(`  Bio:          ${u.bio_description || '(none)'}`);
  console.log(`  Verified:     ${u.is_verified ? 'Yes' : 'No'}`);
  console.log(`  Followers:    ${u.follower_count || 0}`);
  console.log(`  Following:    ${u.following_count || 0}`);
  console.log(`  Likes:        ${u.likes_count || 0}`);
  console.log(`  Videos:       ${u.video_count || 0}`);
  console.log(`  Profile:      ${u.profile_deep_link || '(none)'}`);
}

async function videoPublishStatus(args) {
  const publishId = args['publish-id'];
  if (!publishId) die('--publish-id is required');

  const data = await tiktokRequest('POST', '/post/publish/status/fetch/', {
    publish_id: publishId,
  });

  const status = data?.data;
  console.log('Publish Status:');
  console.log(`  Publish ID:      ${publishId}`);
  console.log(`  Status:          ${status?.status || '(unknown)'}`);
  if (status?.uploaded_bytes !== undefined) {
    console.log(`  Uploaded Bytes:  ${status.uploaded_bytes}`);
  }
  if (status?.video_id) {
    console.log(`  Video ID:        ${status.video_id}`);
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

  if (resource === 'video' && action === 'info') {
    await videoInfo(args);
  } else if (resource === 'video' && action === 'list') {
    await videoList(args);
  } else if (resource === 'video' && action === 'publish-status') {
    await videoPublishStatus(args);
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
