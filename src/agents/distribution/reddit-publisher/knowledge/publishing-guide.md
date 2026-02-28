# Reddit Publishing Guide

## API Considerations
- Respect Reddit API rate limits (60 requests/minute for OAuth)
- Use exponential backoff for failures
- Track submission IDs for monitoring
- Handle moderator removal gracefully

## Formatting
- Reddit uses its own markdown variant
- Test formatting before submission
- Use proper flair and categorization
- Include required information per subreddit rules

## Rate Limit Strategy
- Maximum 1 post per subreddit per 24 hours (general guideline)
- Distribute posts across time zones
- Monitor karma impact for posting account
- Avoid rapid successive posts across subreddits
