# AI Cost Model — Per-Tenant Economics

## Purpose
Model the actual AI API cost per tenant to validate the $99/user/month pricing.

## Assumptions
- Mid-market GC: 50-200 users
- AI provider: OpenAI GPT-4o / Anthropic Claude (blended rate)
- Average input: 2K tokens, average output: 500 tokens
- GPT-4o pricing: $2.50/1M input, $10/1M output (as of Feb 2026)
- Claude Sonnet: $3/1M input, $15/1M output

## Per-Feature AI Cost Estimates

### Daily Usage (per tenant, 50 users active)

| Feature | Interactions/Day | Avg Tokens (in/out) | Cost/Interaction | Daily Cost |
|---|---|---|---|---|
| AI Chat (project-aware) | 25 | 3K / 1K | $0.018 | $0.44 |
| Smart Field Suggestions | 100 | 500 / 200 | $0.003 | $0.33 |
| AI Morning Briefing | 20 | 2K / 1K | $0.018 | $0.35 |
| AI RFI Draft Responses | 5 | 4K / 2K | $0.030 | $0.15 |
| AI Cost-to-Complete (batch) | 1 (nightly) | 10K / 2K | $0.045 | $0.05 |
| **Subtotal (daily features)** | | | | **$1.32** |

### Monthly Usage (per tenant)

| Feature | Interactions/Month | Cost/Interaction | Monthly Cost |
|---|---|---|---|
| Invoice Data Extraction (OCR) | 200 invoices | $0.05 (vision) | $10.00 |
| Document Intelligence | 50 docs | $0.08 | $4.00 |
| Daily features (30 days) | — | — | $39.60 |
| **Total AI Cost/Month** | | | **$53.60** |

### Scaled by Tenant Size

| Tenant Size | Active Users | AI Cost/Month | Revenue/Month | AI as % Revenue |
|---|---|---|---|---|
| 25 users | 15 active | ~$30 | $2,475 | 1.2% |
| 50 users | 30 active | ~$54 | $4,950 | 1.1% |
| 100 users | 60 active | ~$100 | $9,900 | 1.0% |
| 200 users | 120 active | ~$190 | $19,800 | 1.0% |

## Analysis

The Round 2 executive review estimated $2,200/month AI cost per 200-user tenant. That was way high. Real cost is closer to **$190/month** because:

1. Most interactions are small (smart field suggestions = 700 tokens total)
2. Batch jobs (cost-to-complete) run once nightly, not per-user
3. Vision/OCR calls are per-document, not per-user
4. We use the cheapest model that gets the job done (Sonnet for chat, GPT-4o-mini for suggestions)

**AI cost is ~1% of revenue.** This is excellent margin. Even if usage doubles, we're at 2%.

## Heavy Usage Scenario (Power Users + Phase 2)

| Feature | Monthly Cost |
|---|---|
| Base features (above) | $190 |
| Delivery Ticket OCR (500 tickets/month) | $25 |
| Voice-to-text transcription | $15 |
| AI schedule optimization (weekly) | $10 |
| Document Crunch-style contract review | $20 |
| **Total heavy usage** | **$260/month** |

Still ~1.3% of revenue for a 200-user tenant. Healthy.

## Recommendations

1. **No per-tenant AI budget caps needed at this scale.** Cost is negligible relative to revenue.
2. **Track usage anyway** (AI Usage Dashboard already shipped). Alert at 2x expected baseline.
3. **Use model routing:** cheap models for suggestions/smart fields, expensive models for document analysis and chat.
4. **Self-hosted customers:** If they bring their own API keys, AI cost is $0 for us. If we provide hosted AI, add $1-3/user/month to self-hosted pricing.
5. **The $99/user price is well-supported.** AI costs are not the risk factor. Hosting infrastructure (PostgreSQL, Redis, compute) is the bigger cost center.

## Infrastructure Cost Comparison (for reference)

| Cost Center | Per Tenant/Month (200 users) | % of Revenue |
|---|---|---|
| AI API calls | $190 | 1.0% |
| PostgreSQL (managed) | $200-400 | 1-2% |
| Redis | $50-100 | 0.3-0.5% |
| Compute (Railway/AWS) | $200-500 | 1-2.5% |
| Blob storage (Phase 2+) | $50-200 | 0.3-1% |
| CDN/bandwidth | $50-100 | 0.3-0.5% |
| **Total COGS** | **$740-1,490** | **3.7-7.5%** |
| **Revenue** | **$19,800** | **100%** |
| **Gross Margin** | **$18,310-19,060** | **92-96%** |

SaaS gross margins above 80% are considered excellent. We're projecting 92-96%.
