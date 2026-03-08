# Instagram Integration Guide

## Overview

MAT integrates with Instagram via the Instagram Graph API (for Business and Creator
accounts) to publish photos, carousels, reels, and stories. The `instagram-creator`
agent generates content and the `instagram-publisher` agent handles media publishing.

## OAuth2 Setup

1. Set up a Facebook App at https://developers.facebook.com/ (Instagram API is accessed through Facebook)
2. Add the **Instagram Graph API** product
3. Connect an Instagram Business or Creator account to a Facebook Page
4. Set redirect URI to `http://localhost:9876/callback`
5. Note the **App ID** and **App Secret**

Store credentials via the CLI:

```bash
mat config set instagram.appId <your-app-id>
mat config set instagram.appSecret <your-app-secret>
mat config auth instagram
```

## Auth Flow

1. MAT opens a browser to Facebook's OAuth dialog with Instagram scopes
2. User logs in and grants Instagram permissions
3. Facebook redirects with an authorization code
4. MAT exchanges the code for a short-lived token (1 hour)
5. MAT exchanges for a long-lived token (60 days)
6. MAT retrieves the Instagram Business Account ID via the Pages API
7. Tokens stored via the credential manager

## Required Permissions

| Permission | Purpose |
|------------|---------|
| `instagram_basic` | Read account info and media |
| `instagram_content_publish` | Publish photos, carousels, reels |
| `pages_show_list` | List connected Facebook Pages |
| `pages_read_engagement` | Read engagement data |

## API Operations

### Publish a Photo

Two-step process: create a container, then publish it.

**Step 1: Create Media Container**

```
POST https://graph.facebook.com/v19.0/<ig_user_id>/media

{
  "image_url": "https://example.com/image.jpg",
  "caption": "Your caption with #hashtags",
  "access_token": "<access_token>"
}
```

**Step 2: Publish Container**

```
POST https://graph.facebook.com/v19.0/<ig_user_id>/media_publish

{
  "creation_id": "<container_id>",
  "access_token": "<access_token>"
}
```

### Publish a Carousel

**Step 1: Create item containers (no caption)**

```
POST https://graph.facebook.com/v19.0/<ig_user_id>/media

{
  "image_url": "https://example.com/image1.jpg",
  "is_carousel_item": true,
  "access_token": "<access_token>"
}
```

Repeat for each image (2-10 items).

**Step 2: Create carousel container**

```
POST https://graph.facebook.com/v19.0/<ig_user_id>/media

{
  "media_type": "CAROUSEL",
  "children": ["<container_1>", "<container_2>"],
  "caption": "Carousel caption",
  "access_token": "<access_token>"
}
```

**Step 3: Publish**

```
POST https://graph.facebook.com/v19.0/<ig_user_id>/media_publish

{
  "creation_id": "<carousel_container_id>",
  "access_token": "<access_token>"
}
```

### Publish a Reel

```
POST https://graph.facebook.com/v19.0/<ig_user_id>/media

{
  "media_type": "REELS",
  "video_url": "https://example.com/reel.mp4",
  "caption": "Reel caption",
  "access_token": "<access_token>"
}
```

Then publish with `/media_publish` as above.

### Get Media Insights

```
GET https://graph.facebook.com/v19.0/<media_id>/insights
  ?metric=impressions,reach,engagement,saved
  &access_token=<access_token>
```

## Content Types

| Type | Media Type | Requirements |
|------|-----------|-------------|
| Photo | IMAGE | JPEG/PNG, max 8 MB, 1:1 or 4:5 aspect ratio preferred |
| Carousel | CAROUSEL | 2-10 images or videos |
| Reel | REELS | MP4, 3-90 seconds, 9:16 aspect ratio, max 1 GB |
| Story | STORIES | Photo or video, 9:16, 24-hour expiry |

## Rate Limits

- **Content publishing:** 25 posts per 24-hour rolling window per account
- **API calls:** 200 calls per user per hour (shared with Facebook)
- **Container creation:** Containers expire after 24 hours if not published
- MAT tracks the 24-hour rolling window and queues posts that would exceed limits

## Token Lifecycle

- Short-lived token: 1 hour
- Long-lived token: **60 days**
- There is no non-expiring Page token equivalent for Instagram
- MAT stores the token expiry date and warns 7 days before expiration
- Run `mat config auth instagram` to re-authenticate when tokens expire

## Error Handling

| Code | Meaning | MAT Behavior |
|------|---------|-------------|
| 190 | Token expired or invalid | Prompt re-auth via `mat config auth instagram` |
| 9004 | Rate limit exceeded | Queue post, retry after cooldown |
| 36003 | Media container expired | Re-create container and retry |
| 2207050 | Image URL not accessible | Log error, notify user to check image hosting |

## Content Guidelines

The `platform-compliance` agent validates content before publishing:

- Caption length: max 2200 characters
- Hashtag limit: max 30 per post (MAT recommends 5-15 for reach)
- Image aspect ratios validated
- Alt text generated for accessibility
- Content policy compliance checked
