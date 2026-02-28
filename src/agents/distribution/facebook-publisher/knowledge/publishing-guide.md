# Facebook Publishing Guide

## Graph API Publishing
- Use Page Access Token for page posts
- User Access Token for group posts (with permissions)
- Handle token expiration and refresh
- Implement retry logic for API errors

## Content Formats
- Text posts: Direct publish via API
- Photo posts: Upload media then attach
- Video posts: Resumable upload for large files
- Link posts: Provide URL for link preview
- Carousel posts: Multiple images with descriptions

## Rate Limits
- Follow Graph API rate limiting
- Space posts appropriately (avoid rapid posting)
- Monitor API usage quota
- Implement exponential backoff

## Post-Publish Tracking
- Store post ID for engagement monitoring
- Track reach, impressions, engagement
- Monitor comments for response needs
- Flag high-performing content for boosting
