# TikTok Integration Guide

## Overview

MAT integrates with TikTok via the Content Publishing API to upload videos
and manage published content. The `tiktok-creator` agent generates content
scripts and metadata; the `tiktok-publisher` agent handles uploads.

## OAuth2 Setup

1. Register at https://developers.tiktok.com/
2. Create an app and request **Content Posting API** access
3. Set redirect URI to `http://localhost:9876/callback`
4. Note the **Client Key** and **Client Secret**

Store credentials via the CLI:

```bash
mat config set tiktok.clientKey <your-client-key>
mat config set tiktok.clientSecret <your-client-secret>
mat config auth tiktok
```

## Auth Flow

1. MAT opens a browser to TikTok's authorization endpoint
2. User logs in and grants permissions
3. TikTok redirects to localhost callback with an authorization code
4. MAT exchanges the code for access + refresh tokens
5. Access tokens expire after 24 hours; refresh tokens after 365 days
6. MAT auto-refreshes access tokens before expiry

## Required Scopes

| Scope | Purpose |
|-------|---------|
| `user.info.basic` | Read user profile |
| `video.publish` | Publish videos |
| `video.upload` | Upload video files |
| `video.list` | List published videos |

## API Operations

### Initialize Video Upload

```
POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/
Content-Type: application/json

{
  "post_info": {
    "title": "Video title",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_comment": false,
    "disable_duet": false,
    "disable_stitch": false
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 52428800
  }
}
```

### Upload Video File

After initialization, upload the video binary to the returned `upload_url`:

```
PUT <upload_url>
Content-Type: video/mp4

<binary video data>
```

### Check Publish Status

```
GET https://open.tiktokapis.com/v2/post/publish/status/fetch/
Content-Type: application/json

{
  "publish_id": "<publish_id>"
}
```

### List Published Videos

```
POST https://open.tiktokapis.com/v2/video/list/
Content-Type: application/json

{
  "max_count": 20
}
```

## Rate Limits

- **Video publishing:** Varies by app tier and account standing
- **API calls:** Subject to per-endpoint rate limits (typically ~100 req/min)
- TikTok returns rate limit info in response headers
- MAT respects backoff signals and queues retries

## Video Requirements

| Parameter | Constraint |
|-----------|-----------|
| Format | MP4, WebM |
| Max file size | 128 MB (varies by account) |
| Min duration | 1 second |
| Max duration | 10 minutes (60 min for some accounts) |
| Resolution | Minimum 720x1280 recommended |
| Aspect ratio | 9:16 (vertical) preferred |

## Error Handling

| Error Code | Meaning | MAT Behavior |
|------------|---------|-------------|
| `ok` | Success | Continue pipeline |
| `spam_risk_too_many_posts` | Posting too frequently | Queue and retry after cooldown |
| `unaudited_client_can_only_post_to_private_accounts` | App not approved | Log warning, notify user |
| `token_expired` | Access token expired | Auto-refresh token |

## Content Guidelines

The `platform-compliance` agent validates content before publishing:

- Hashtag count and relevance checked
- Music/audio licensing not handled (video-only uploads)
- Content policy compliance verified
- Caption length validated (max 2200 characters)
