# Facebook Integration Guide

## Overview

MAT integrates with Facebook via the Graph API to publish posts to Pages.
The `facebook-creator` agent generates content and the `facebook-publisher`
agent handles posting through the Page API.

## OAuth2 Setup

1. Go to https://developers.facebook.com/ and create an app (type: Business)
2. Add the **Facebook Login** product
3. Set redirect URI to `http://localhost:9876/callback`
4. Note the **App ID** and **App Secret**

Store credentials via the CLI:

```bash
mat config set facebook.appId <your-app-id>
mat config set facebook.appSecret <your-app-secret>
mat config auth facebook
```

## Auth Flow

1. MAT opens a browser to Facebook's OAuth dialog
2. User logs in and grants page permissions
3. Facebook redirects with an authorization code
4. MAT exchanges the code for a short-lived user token (1 hour)
5. MAT exchanges the short-lived token for a long-lived token (60 days)
6. MAT retrieves the Page Access Token (does not expire for permanent pages)
7. Tokens stored via the credential manager

## Required Permissions

| Permission | Purpose |
|------------|---------|
| `pages_manage_posts` | Create and manage Page posts |
| `pages_read_engagement` | Read post insights and engagement |
| `pages_show_list` | List pages the user manages |
| `pages_read_user_content` | Read user-generated content on Page |

## API Operations

### Publish a Text Post

```
POST https://graph.facebook.com/v19.0/<page_id>/feed
Content-Type: application/json

{
  "message": "Post content here",
  "access_token": "<page_access_token>"
}
```

### Publish a Link Post

```
POST https://graph.facebook.com/v19.0/<page_id>/feed

{
  "message": "Check this out",
  "link": "https://example.com/article",
  "access_token": "<page_access_token>"
}
```

### Publish a Photo Post

```
POST https://graph.facebook.com/v19.0/<page_id>/photos

{
  "url": "https://example.com/image.jpg",
  "caption": "Photo caption",
  "access_token": "<page_access_token>"
}
```

### Publish a Video Post

```
POST https://graph.facebook.com/v19.0/<page_id>/videos

{
  "file_url": "https://example.com/video.mp4",
  "description": "Video description",
  "access_token": "<page_access_token>"
}
```

### Get Post Insights

```
GET https://graph.facebook.com/v19.0/<post_id>/insights
  ?metric=post_impressions,post_engagements,post_clicks
  &access_token=<page_access_token>
```

## Content Types

| Type | Endpoint | Notes |
|------|----------|-------|
| Text | `/<page_id>/feed` | Plain text post |
| Link | `/<page_id>/feed` | Auto-generates link preview |
| Photo | `/<page_id>/photos` | JPEG, PNG, max 10 MB |
| Video | `/<page_id>/videos` | MP4, max 10 GB, max 240 min |
| Carousel | `/<page_id>/feed` | Multiple images via `child_attachments` |

## Rate Limits

- **Application-level:** 200 calls per user per hour
- **Page posting:** No hard limit, but excessive posting triggers spam detection
- Facebook returns `x-app-usage` and `x-page-usage` headers with utilization percentages
- MAT monitors usage headers and throttles at 80% utilization
- Batch API available for multiple reads (up to 50 per batch)

## Error Handling

| Code | Meaning | MAT Behavior |
|------|---------|-------------|
| 190 | Invalid or expired token | Re-authenticate via `mat config auth facebook` |
| 4 | Application request limit reached | Backoff until reset |
| 10 | Permission denied | Log error, notify user to check app permissions |
| 506 | Duplicate post | Skip, log as already published |

## Token Lifecycle

- Short-lived user token: 1 hour
- Long-lived user token: 60 days
- Page access token: Does not expire (when derived from long-lived user token)
- MAT checks token validity on each pipeline run and prompts re-auth when needed
