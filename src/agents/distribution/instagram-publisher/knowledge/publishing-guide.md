# Instagram Publishing Guide

## Media Specifications
- **Images**: JPEG, min 320px, max 1440px wide, aspect 4:5 to 1.91:1
- **Videos/Reels**: MP4, H.264, AAC audio, max 100MB, 3-90 seconds
- **Carousels**: 2-10 media items, consistent aspect ratio
- **Stories**: 1080x1920 (9:16), max 15 seconds per frame

## Graph API Publishing Flow
1. Create media container with media URL and caption
2. Wait for container to finish processing
3. Publish the container
4. Store media ID for tracking

## Rate Limits
- Follow Instagram Graph API rate limits
- Container creation has separate limits from publishing
- Implement polling for processing status
- Use exponential backoff for retries

## Best Practices
- Verify media processing before publishing
- Handle multi-image carousels sequentially
- Store all media IDs for future reference
- Monitor for post removal or restriction
