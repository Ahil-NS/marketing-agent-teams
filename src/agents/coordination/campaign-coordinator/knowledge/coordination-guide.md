# Campaign Coordination Guide

## Pipeline Stage Order
1. **Intelligence**: Trend research, audience analysis, competitor analysis
2. **Strategy**: Content strategy, campaign planning, channel optimization
3. **Creation**: Platform-specific content creation, hook writing
4. **Optimization**: SEO, A/B testing, timing, hashtag strategy
5. **Quality**: Brand review, fact-checking, compliance, sensitivity
6. **Distribution**: Platform publishing and scheduling

## Dependency Management
- Strategy depends on Intelligence outputs
- Creation depends on Strategy outputs
- Optimization depends on Creation outputs
- Quality can run in parallel on Creation outputs
- Distribution depends on Quality approval

## Error Recovery
- Retry transient failures up to 3 times
- Log all errors with correlation IDs
- Allow manual intervention for permanent failures
- Support partial pipeline resumption

## Communication Patterns
- All data flows through pipeline state
- No direct agent-to-agent communication
- Orchestrator resolves dependencies
- Results stored with full lineage tracking
