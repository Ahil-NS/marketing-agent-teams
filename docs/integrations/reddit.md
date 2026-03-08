# Reddit Integration Guide

## Overview

MAT integrates with Reddit via the OAuth2 API to submit posts, fetch content, and
post comments. The `reddit-creator` agent generates content and the `reddit-publisher`
agent handles submission.

## OAuth2 Setup

1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app..."
3. Select **script** (for personal use) or **web app** (for distributed use)
4. Set redirect URI to `http://localhost:9876/callback`
5. Note the **client ID** (under the app name) and **client secret**

Store credentials via the CLI:

```bash
mat config set reddit.clientId <your-client-id>
mat config set reddit.clientSecret <your-client-secret>
mat config auth reddit
```

The `mat config auth reddit` command launches the OAuth2 flow and stores the
refresh token securely.

## Auth Flow

1. MAT opens a browser to Reddit's authorization URL
2. User grants permissions (identity, submit, read, privatemessages)
3. Reddit redirects to localhost callback with an authorization code
4. MAT exchanges the code for access + refresh tokens
5. Tokens are stored via the credential manager (keytar)
6. Access tokens are refreshed automatically (1-hour expiry)

## Required Scopes

| Scope | Purpose |
|-------|---------|
| `identity` | Verify account identity |
| `submit` | Submit posts and comments |
| `read` | Read subreddit content |
| `privatemessages` | Check inbox for moderation notices |

## API Operations

### Submit a Post

```
POST https://oauth.reddit.com/api/submit
Content-Type: application/x-www-form-urlencoded

sr=<subreddit>&kind=self&title=<title>&text=<body>
```

Supported post kinds: `self` (text), `link`, `image`, `video`.

### Post a Comment

```
POST https://oauth.reddit.com/api/comment
Content-Type: application/x-www-form-urlencoded

thing_id=<parent_fullname>&text=<body>
```

### Fetch Subreddit Posts

```
GET https://oauth.reddit.com/r/<subreddit>/hot?limit=25
```

Sort options: `hot`, `new`, `top`, `rising`.

### Fetch Post Comments

```
GET https://oauth.reddit.com/comments/<article_id>?sort=best&limit=100
```

## Rate Limits

- **60 requests per minute** per OAuth2 token
- Reddit returns `X-Ratelimit-Remaining` and `X-Ratelimit-Reset` headers
- MAT automatically throttles requests and backs off on 429 responses
- Posting limit: approximately 1 post per 10 minutes for new accounts

## Error Handling

| Status | Meaning | MAT Behavior |
|--------|---------|-------------|
| 401 | Token expired | Auto-refresh using stored refresh token |
| 403 | Insufficient scope or banned | Log error, skip subreddit |
| 429 | Rate limited | Backoff using reset header value |
| 503 | Reddit overloaded | Retry with exponential backoff (max 3 retries) |

## Content Guidelines

The `platform-compliance` agent checks content against Reddit's content policy
before the `reddit-publisher` submits. Key rules enforced:

- No vote manipulation language
- No spam or excessive self-promotion
- Subreddit-specific rules checked when available
- Markdown formatting validated for Reddit's parser
