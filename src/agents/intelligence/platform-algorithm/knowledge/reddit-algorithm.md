# Reddit Algorithm Mechanics

## Reddit Ranking Algorithms

Reddit uses multiple sorting algorithms that determine which content gets
visibility. Understanding these is critical for content distribution.

### Hot Algorithm
The default sort for most subreddits. Combines recency with engagement velocity.
- **Formula factors:** Score (upvotes - downvotes), time elapsed since posting
- **Time decay:** Logarithmic — early votes count significantly more than later ones
- **Key insight:** The first 10 upvotes have the same weight as the next 100
- **Practical impact:** Early engagement velocity determines long-term visibility

### Best Algorithm
Used as default on the front page and r/all. Bayesian estimation of quality.
- **Formula:** Wilson score confidence interval — handles low-vote-count posts
  more fairly than simple upvote percentage
- **Key insight:** A post with 5 upvotes and 0 downvotes can outscore a post with
  100 upvotes and 50 downvotes because of confidence intervals
- **Practical impact:** High-quality posts in small communities can surface

### Rising Algorithm
Identifies posts gaining engagement momentum.
- **Formula:** Weighted recent engagement velocity relative to post age
- **Key insight:** Posts that accelerate in upvotes/comments get surfaced here
- **Practical impact:** Getting onto Rising is the gateway to r/all

### Top Algorithm
Pure score ranking over time periods (hour, day, week, month, year, all).
- **Sorts by:** Raw score (upvotes - downvotes) within the time window
- **Practical impact:** Useful for understanding what performs best, not for distribution

## Karma System

### Post Karma
- Accumulated from upvotes on posts (not 1:1 — diminishing returns at scale)
- Higher karma accounts get slight visibility advantages in some contexts
- New accounts face posting restrictions in many subreddits

### Comment Karma
- Accumulated from upvotes on comments
- More valuable for credibility — many subreddits have minimum comment karma requirements
- High comment karma is a signal of genuine community participation

### Subreddit-Specific Karma
- Some subreddits require minimum karma within that subreddit to post
- Building subreddit-specific reputation takes consistent participation
- Helps filter out drive-by spam and self-promotion

## Engagement Signals

### Primary Signals (Highest Weight)
1. **Upvote velocity** — Speed of upvotes in the first 1-2 hours
2. **Comment count** — Number of comments, especially early comments
3. **Comment engagement** — Replies to comments indicate genuine discussion
4. **Score ratio** — Upvote/downvote ratio (visible as percentage)

### Secondary Signals
1. **Awards/Gold** — Reddit premium awards signal high-quality content
2. **Cross-posts** — Content cross-posted to other subreddits gains multiplied exposure
3. **Save rate** — Users saving the post for later indicates reference value
4. **Report rate (negative)** — Reports reduce visibility and can trigger removal

## New Account Trust Building

- Most subreddits restrict new accounts (< 30 days or < 100 karma)
- Start by commenting valuable contributions in discussions
- Build karma through helpful comments before posting original content
- Avoid self-promotion until established (Reddit 90/10 self-promotion rule)
- Participate in AMAs, discussion threads, and help posts

## Shadowban Avoidance

### Common Triggers
- Posting the same link across multiple subreddits too quickly
- Using URL shorteners (Reddit flags these)
- Excessive self-promotion without community contribution
- Manipulating votes through multiple accounts
- Posting spam or affiliate links without disclosure

### Detection
- Check if posts appear in subreddit /new when logged out
- Use Reddit shadowban checker tools
- Posts getting zero engagement (not even downvotes) is a red flag

## Subreddit-Specific Optimization

- Each subreddit has unique rules, posting guidelines, and culture
- Read the sidebar rules before posting in any subreddit
- Observe what content performs well in the specific subreddit
- Many subreddits have designated days for specific content types
- Moderators have significant power — work with them, not against them
