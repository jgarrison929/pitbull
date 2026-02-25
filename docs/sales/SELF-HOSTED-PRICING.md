# Self-Hosted Pricing Model — Recommendation

## The Problem

The Round 2 executive review flagged this: "$0 software is for open-source projects, not pre-seed startups." If self-hosted is free, where's the recurring revenue?

## Options Evaluated

### Option A: Free Software + Required Support Contract
- Software: $0
- Support: $500-2,000/month (SLA-based tiers)
- **Problem:** Support-only revenue is a hard sell to investors. Low perceived value. Customers will try to skip support.

### Option B: Discounted Self-Hosted License
- Self-hosted: $49/user/month (50% discount vs cloud)
- Includes updates + email support
- Premium support: +$500/month
- **Problem:** Why would anyone choose cloud at $99 when self-hosted is $49? Creates pricing confusion.

### Option C: Free Core + Paid AI (Recommended)
- Core ERP: Free to self-host (open-core model)
- AI features: $29/user/month (requires our AI gateway for model routing, caching, fine-tuning)
- Support: Optional, $500-2,000/month
- **Why this works:** The core ERP gets adoption. AI is the premium tier that generates recurring revenue. Customers who bring their own API keys still need our AI orchestration layer for construction-specific prompts, model routing, and caching.

### Option D: Usage-Based AI Credits
- Software: $0
- AI: Pay-per-use ($0.01-0.10 per AI interaction)
- **Problem:** Unpredictable revenue. Hard to forecast. Customers hate surprise bills.

## Recommendation: Hybrid (Cloud-First, Self-Hosted Available)

**Don't lead with self-hosted.** Lead with cloud at $99/user/month. Self-hosted is the answer to the objection "we can't put financial data in your cloud."

### Cloud (Primary)
- $99/user/month, everything included
- No setup fee for <100 users
- Implementation services: $5-15K one-time (optional)

### Self-Hosted (On Request)
- $49/user/month (license + updates + AI gateway access)
- Or: Bring your own AI keys at $29/user/month (updates only, no AI gateway)
- Setup assistance: $10-25K one-time
- Premium support SLA: +$1,000/month

### Enterprise (Custom)
- Custom pricing for 500+ users
- Dedicated infrastructure, custom integrations, on-site training
- Annual contracts, volume discounts

## Revenue Projections (First 12 Months)

| Scenario | Customers | Avg Users | Avg MRR/Customer | Total MRR |
|---|---|---|---|---|
| Conservative | 3 cloud | 40 | $3,960 | $11,880 |
| Moderate | 5 cloud + 1 self-hosted | 50 avg | $4,500 avg | $27,000 |
| Optimistic | 8 cloud + 2 self-hosted | 60 avg | $4,800 avg | $48,000 |

Conservative = $143K ARR. Moderate = $324K ARR. Optimistic = $576K ARR.

Target for pre-seed investors: 3-5 customers, $100-300K ARR within 12 months.

## Key Decisions for Josh

1. **Do we actually open-source the core?** Open-core gets GitHub stars and developer credibility but gives competitors your code. Alternative: source-available license (BSL or similar) that allows self-hosting but not competing SaaS.
2. **AI gateway pricing:** $29 vs $49/user for self-hosted. The gap determines how hard we push cloud.
3. **Implementation fees:** $5K is approachable for a $50M GC. $15K is still less than Vista implementation. This is real revenue on day one.
4. **When to publish pricing:** Not yet. First 3 customers should be hand-priced based on their needs. Published pricing comes after we have reference customers.
