# Stage Definitions

## Stage Sequence and Agent Assignments

### Stage 1: Research
Agents: trend-scout, audience-researcher, competitor-analyst, viral-pattern-decoder, platform-algorithm
Input: Pipeline config (platforms, dryRun, brand context)
Output: Trend briefs, audience profiles, competitor analysis, viral patterns, algorithm insights

### Stage 2: Strategy
Agents: content-strategist, campaign-planner, channel-optimizer
Input: All research stage outputs
Output: Content strategy, campaign plan, channel recommendations

### Stage 3: Creation
Agents: reddit-creator, tiktok-creator, facebook-creator, instagram-creator, hook-writer, content-atomizer
Input: Research + strategy outputs
Output: Platform-specific content items (posts, captions, hooks, atomized variants)
Note: Only run creators for platforms specified in pipeline config

### Stage 4: Optimization
Agents: seo-optimizer, ab-test-designer, timing-optimizer, hashtag-strategist
Input: Creation stage outputs
Output: SEO-optimized content, A/B variants, posting schedules, hashtag sets

### Stage 5: Quality
Agents: brand-guardian, fact-checker, platform-compliance, sensitivity-reviewer
Input: Creation + optimization outputs
Output: Quality scores, compliance checks, sensitivity flags, fact-check results

### Stage 6: Review
No agents — pipeline pauses for human review.
The coordinator writes quality-checked content to the review queue and stops.

### Stage 7: Distribution
Agents: reddit-publisher, tiktok-publisher, facebook-publisher, instagram-publisher
Input: Approved content from review queue
Output: Published content with URLs and engagement tracking
Note: Only runs after human approval via `mat review approve`

## Input/Output Contracts

Each agent receives a JSON prompt with:
- `stage`: Current pipeline stage name
- `platforms`: Target platform list from config
- `dryRun`: Whether to skip actual publishing
- `upstreamOutputs`: Combined outputs from dependency stages
- `brandContext`: Product marketing context (if `.mat/context/product-marketing-context.md` exists)

Each agent must return valid JSON with at minimum:
- `agentName`: The agent's name
- `status`: "success" or "partial"
- `outputs`: Stage-specific output object
