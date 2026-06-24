# AI Integration Design Spec

**Module:** `Pitbull.AI`
**Status:** Draft
**Author:** J. Garrison
**Date:** 2026-02-16
**Reviewed by:** Gemini CLI Agent (domain expert review, 2026-02-16)

---

## 1. Overview

Pitbull's competitive advantage over Vista, Procore, and CMiC is **embedded AI that understands construction workflows**. Not a bolted-on chatbot — AI that reads your RFIs, writes first drafts, flags cost overruns before they happen, and connects the dots across project data that no PM has time to trace manually.

This spec covers the shared AI service layer, provider abstraction, concrete use cases, and the infrastructure (async processing, caching, cost controls) required to ship AI features across all Pitbull modules.

### What exists today

`AiInsightsService` (in `Pitbull.Api/Services/`) already calls Claude Sonnet to analyze project health via time entry data. The RFI entity has `AiSuggestedAnswer` and `AiAnalyzedAt` columns. This spec formalizes and expands that foundation.

---

## 2. Architecture

### 2.1 Module structure

```
src/
├── Modules/
│   └── Pitbull.AI/
│       ├── Pitbull.AI.csproj
│       ├── Providers/
│       │   ├── IAiProvider.cs            # Provider abstraction
│       │   ├── AnthropicProvider.cs       # Claude API (analysis, documents)
│       │   ├── OpenAiProvider.cs          # GPT-4o (text gen), embeddings
│       │   └── AiProviderFactory.cs       # Resolves provider by capability
│       ├── Services/
│       │   ├── IAiOrchestrationService.cs # Routes requests to providers
│       │   ├── AiOrchestrationService.cs
│       │   ├── IEmbeddingService.cs       # Vector search
│       │   ├── EmbeddingService.cs
│       │   ├── ITokenBudgetService.cs     # Usage tracking + limits
│       │   ├── TokenBudgetService.cs
│       │   ├── IPromptRegistryService.cs  # Prompt versioning + resolution
│       │   └── PromptRegistryService.cs
│       ├── Caching/
│       │   ├── IAiCacheService.cs
│       │   └── RedisAiCacheService.cs
│       ├── Processing/
│       │   ├── Messages/                  # MassTransit message contracts
│       │   └── Consumers/                 # Async job consumers
│       ├── Domain/
│       │   ├── AiApiKey.cs                # Per-tenant API key storage
│       │   ├── AiUsageLog.cs              # Token/cost tracking
│       │   ├── AiEmbedding.cs             # Stored vectors
│       │   ├── AiPromptTemplate.cs        # Versioned prompt registry
│       │   └── AiFeedback.cs              # Human-in-the-loop feedback
│       └── Data/
│           └── AiConfigurations.cs        # EF entity configs
│
├── Pitbull.Api/
│   └── Controllers/
│       └── AiController.cs               # AI endpoints
```

### 2.2 Provider abstraction

The core abstraction lets callers request AI capabilities without coupling to a vendor. The factory resolves the appropriate provider based on the requested capability.

```csharp
public enum AiCapability
{
    TextGeneration,       // Drafting, summarization
    Analysis,             // Deep reasoning over structured data
    DocumentUnderstanding,// PDF/image parsing
    Embedding,            // Vector generation for search
    ImageAnalysis,        // Photo/image interpretation (safety, progress)
    CodeGeneration        // Formula/query generation (future)
}

public interface IAiProvider
{
    string Name { get; }                            // "anthropic" | "openai"
    IReadOnlySet<AiCapability> Capabilities { get; }

    Task<Result<AiCompletionResult>> CompleteAsync(
        AiCompletionRequest request,
        CancellationToken ct = default);
}

public record AiCompletionRequest(
    string SystemPrompt,
    string UserPrompt,
    AiCapability Capability,
    int MaxTokens = 4096,
    decimal Temperature = 0.3m,
    string? ModelOverride = null        // Optional: force specific model
);

public record AiCompletionResult(
    string Content,
    int InputTokens,
    int OutputTokens,
    string Model,
    string Provider,
    TimeSpan Latency
);
```

**Default provider routing:**

| Capability | Primary Provider | Model | Rationale |
|---|---|---|---|
| TextGeneration | OpenAI | `gpt-4o` | Fast, cost-effective for drafts |
| Analysis | Anthropic | `claude-sonnet-4-20250514` | Superior at structured reasoning over construction data |
| DocumentUnderstanding | Anthropic | `claude-sonnet-4-20250514` | Native PDF/image input |
| ImageAnalysis | Anthropic | `claude-sonnet-4-20250514` | Native image input, strong visual reasoning |
| Embedding | OpenAI | `text-embedding-3-large` | 3072-dim vectors, best cost/quality ratio |

Routing is configurable per tenant via `ai_settings` JSONB on the Company entity, so a tenant can override to use Claude for everything if they prefer.

### 2.3 Orchestration service

`AiOrchestrationService` is the single entry point all feature services call. It handles: prompt resolution, provider resolution, token budget checks, caching, usage logging, and error standardization.

```csharp
public interface IAiOrchestrationService
{
    Task<Result<AiCompletionResult>> RequestAsync(
        AiCompletionRequest request,
        AiRequestContext context,           // TenantId, CompanyId, ProjectId, feature tag
        CancellationToken ct = default);

    Task<Result<float[]>> EmbedAsync(
        string text,
        AiRequestContext context,
        CancellationToken ct = default);
}

public record AiRequestContext(
    Guid TenantId,
    Guid CompanyId,
    Guid? ProjectId,
    string FeatureTag          // "rfi-draft", "daily-report-summary", etc.
);
```

Flow for every AI request:

```
Caller → AiOrchestrationService
           ├── Resolve prompt template (PromptRegistryService)
           │     └── Active template for FeatureTag? → use it; else → use caller's default
           ├── Check token budget (TokenBudgetService)
           │     └── OVER_BUDGET? → Result.Failure("Monthly AI budget exceeded", "AI_BUDGET_EXCEEDED")
           ├── Check cache (AiCacheService)
           │     └── HIT? → return cached result
           ├── Resolve provider (AiProviderFactory)
           ├── Call provider
           ├── Log usage (AiUsageLog)
           ├── Cache result
           └── Return Result<AiCompletionResult>
```

### 2.4 Async processing via MassTransit

Long-running AI jobs (embedding an entire project's documents, batch daily report summaries) run asynchronously. MassTransit with the existing PostgreSQL as transport (no RabbitMQ dependency for on-prem).

**Message contracts:**

```csharp
// Published when an entity needs AI processing
public record AiAnalysisRequested(
    Guid TenantId,
    Guid CompanyId,
    Guid EntityId,
    string EntityType,          // "Rfi", "DailyReport", "ChangeOrder"
    string AnalysisType,        // "draft-answer", "summarize", "impact-analysis"
    Guid RequestedByUserId,
    DateTime RequestedAt
);

// Published when analysis completes
public record AiAnalysisCompleted(
    Guid TenantId,
    Guid CompanyId,
    Guid EntityId,
    string EntityType,
    string AnalysisType,
    bool Success,
    string? Error
);
```

**Consumers:**

| Consumer | Trigger | Action |
|---|---|---|
| `RfiDraftConsumer` | RFI created with status Open | Generate suggested answer, write to `Rfi.AiSuggestedAnswer` |
| `DailyReportSummaryConsumer` | Daily report submitted | Summarize work/delays/safety narratives into executive summary |
| `ChangeOrderImpactConsumer` | Change order created | Analyze cost/schedule impact against budget and timeline |
| `DocumentEmbeddingConsumer` | Document uploaded | Generate embedding, store in `ai_embeddings` table |
| `ScheduleRiskConsumer` | Schedule baseline updated | Predict delay risks from activity dependencies and float |
| `SubmittalLogConsumer` | Spec book PDF uploaded | Parse spec book and auto-generate submittal log entries |
| `PayAppReviewConsumer` | Pay application PDF uploaded | Extract line items, validate math, flag discrepancies |
| `MeetingMinutesConsumer` | Meeting recording transcript saved | Extract action items with assignees and due dates |
| `SafetyPhotoConsumer` | Site photo uploaded to daily report | Analyze for OSHA hazards and safety violations |
| `EmbeddingReindexConsumer` | Embedding model version change | Re-embed all stale embeddings with new model |

MassTransit registration in `Program.cs`:

```csharp
builder.Services.AddMassTransit(x =>
{
    x.AddConsumersFromNamespaceContaining<RfiDraftConsumer>();
    x.UsingPostgres((context, cfg) =>
    {
        cfg.UseDbContext<PitbullDbContext>();
        cfg.ConfigureEndpoints(context);
    });
});
```

### 2.5 Caching

Redis (already in docker-compose, not yet wired) caches AI responses to avoid duplicate calls for identical prompts.

**Cache key structure:** `ai:{tenantId}:{featureTag}:{contentHash}`

**TTL by feature:**

| Feature | TTL | Rationale |
|---|---|---|
| RFI draft suggestions | 24h | Context doesn't change rapidly |
| Daily report summaries | 7d | Report content is immutable after submission |
| Cost code suggestions | 1h | Active project data changes frequently |
| Embeddings | 30d | Only invalidated when source document changes |
| Project health analysis | 4h | Balances freshness with cost |

**Cache invalidation:** Entity update events clear relevant cache keys. E.g., updating an RFI's question invalidates its draft suggestion cache.

```csharp
public interface IAiCacheService
{
    Task<AiCompletionResult?> GetAsync(string cacheKey, CancellationToken ct = default);
    Task SetAsync(string cacheKey, AiCompletionResult result, TimeSpan ttl, CancellationToken ct = default);
    Task InvalidateAsync(string pattern, CancellationToken ct = default);
}
```

Registration:

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "pitbull:";
});
builder.Services.AddScoped<IAiCacheService, RedisAiCacheService>();
```

### 2.6 Prompt registry

Prompts are a form of code — they need versioning, testing, and deployment independent of application releases. A database-backed prompt registry stores all system prompts and allows updating AI behavior without a code deployment.

```csharp
public class AiPromptTemplate : BaseEntity
{
    public string FeatureTag { get; set; }          // "rfi-draft", "cost-code-suggest", etc.
    public int Version { get; set; }                // Auto-incremented per feature tag
    public string SystemPrompt { get; set; }        // The prompt text
    public string? UserPromptTemplate { get; set; } // Handlebars-style template with {{variables}}
    public bool IsActive { get; set; }              // Only one active version per feature tag
    public string? Notes { get; set; }              // Changelog / rationale for this version
    public DateTime CreatedAt { get; set; }
    public Guid CreatedByUserId { get; set; }
}
```

EF configuration:
```
Table: ai_prompt_templates
Unique index: (FeatureTag, Version)
Filtered unique index: (FeatureTag) WHERE IsActive = true  -- enforces single active version
SystemPrompt: required, no max length (text column)
```

**Resolution flow:** `AiOrchestrationService` resolves the active prompt template for the given `FeatureTag` before every AI call. If no template exists, the hardcoded default in the consumer/service is used as a fallback. This lets the system work out of the box while allowing prompt iteration through the admin UI.

**Admin API:**
```
GET    /api/admin/ai/prompts                        # List all prompt templates
GET    /api/admin/ai/prompts/{featureTag}/versions   # Version history for a feature
POST   /api/admin/ai/prompts                        # Create new version (auto-increments)
PUT    /api/admin/ai/prompts/{id}/activate           # Activate a specific version
POST   /api/admin/ai/prompts/{id}/test               # Dry-run prompt against sample input
```

### 2.7 Human-in-the-loop feedback

AI outputs are always reviewed by a human before acting on them. To improve quality over time, the system captures explicit feedback on AI-generated content. This data drives prompt iteration and identifies systemic weaknesses.

```csharp
public class AiFeedback : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid UserId { get; set; }
    public string FeatureTag { get; set; }          // "rfi-draft", "daily-report-summary", etc.
    public Guid EntityId { get; set; }              // The entity the AI output was for
    public string EntityType { get; set; }          // "Rfi", "DailyReport", etc.
    public AiFeedbackRating Rating { get; set; }    // ThumbsUp, ThumbsDown, Neutral
    public string? AiOriginalOutput { get; set; }   // What the AI generated
    public string? UserEditedOutput { get; set; }   // What the user actually used (if edited)
    public string? Comment { get; set; }            // Optional free-text feedback
    public DateTime CreatedAt { get; set; }
}

public enum AiFeedbackRating { ThumbsUp, ThumbsDown, Neutral }
```

EF configuration:
```
Table: ai_feedback
Indexes: (FeatureTag, Rating, CreatedAt), (CompanyId, CreatedAt)
Rating: HasConversion<string>().HasMaxLength(20)
```

**UX pattern:** Every AI-generated output in the UI includes a thumbs up/down control. When a user edits an AI draft (e.g., modifies an RFI suggested answer before sending), the system captures both the original AI output and the final edited version on save. This "implicit feedback" is the most valuable signal — it shows exactly where the AI fell short.

**Feedback analysis:** Admin dashboard surfaces:
- Approval rate per feature tag (% thumbs up)
- Most-edited features (high edit distance between AI output and user final version)
- Trends over time (does a prompt change improve approval rate?)

**API endpoints:**
```
POST   /api/ai/feedback                             # Submit feedback (thumbs up/down + optional edit)
GET    /api/admin/ai/feedback/summary               # Aggregated feedback metrics
GET    /api/admin/ai/feedback?featureTag={tag}       # Raw feedback entries for analysis
```

### 2.8 Context structuring for multi-modal data

Use cases that reason over diverse data types (structured financial numbers, schedule dates, unstructured text) require deliberate context formatting. Simply concatenating data into a prompt is ineffective — the LLM needs clear boundaries between data sources to reason correctly.

**Standard:** All prompts that combine multiple data types use XML-tagged sections to structure context:

```
<budget_data>
  Original Contract: $2,400,000
  Approved Changes: +$145,000
  Current Budget: $2,545,000
  Actual-to-Date: $1,870,000 (73.5%)
</budget_data>

<schedule_data>
  Contract Completion: 2026-08-30
  Current Projected: 2026-09-15
  Critical Path Float: -2 days
  SPI (3-period avg): 0.82
</schedule_data>

<narrative_context>
  Daily report from 2026-02-14: "Concrete pour delayed due to rain.
  Rebar crew stood down for 4 hours. Weather cleared at 1 PM,
  resumed work on Level 2 slab."
</narrative_context>

<subcontractor_history>
  Subcontract: ABC Electric (SC-007)
  Original Amount: $340,000
  Approved COs: 3 totaling +$45,200
  Current Committed: $385,200
</subcontractor_history>
```

This format is enforced by the `UserPromptTemplate` field in the Prompt Registry (section 2.6). Template variables are resolved at runtime from the gathered entity data. This approach helps the LLM differentiate and reason over distinct data sources more effectively than flat concatenation.

---

## 3. Use Cases

### 3.1 RFI draft generation

**Trigger:** User creates an RFI or clicks "Generate AI Draft" on an existing open RFI.

**Input data gathered:**
- `Rfi.Question`, `Rfi.Subject`, `Rfi.SpecSection`, `Rfi.DrawingReferences`
- Project context: `Project.Name`, `Project.Type`, `Project.Description`
- Historical RFIs on same project (answered ones) for tone/format consistency
- Related spec section text if available (from `PmSpecSection` entities)

**System prompt:**
```
You are a construction project manager drafting an RFI response for a commercial
general contractor. Use industry-standard terminology. Reference specific spec
sections and drawing numbers when applicable. Be concise and actionable.
The response should be suitable for sending to an architect or engineer.
```

**Output:** Written to `Rfi.AiSuggestedAnswer` and `Rfi.AiAnalyzedAt`. The PM reviews and edits before sending — AI never auto-sends.

**Provider:** Anthropic Claude (Analysis capability — needs to reason about construction specs).

**Estimated tokens:** ~2,000 input, ~800 output per RFI.

### 3.2 Daily report summarization

**Trigger:** Foreman submits daily report (status → Submitted). Async via MassTransit.

**Input data gathered from `PmDailyReport` and child tables:**
- `WorkNarrative`, `DelaysNarrative`, `SafetyNarrative`
- `PmDailyReportCrew` entries (company, trade, headcount, hours)
- `PmDailyReportEquipment` entries
- `PmDailyReportSafetyIncident` entries (type, severity)
- `PmDailyReportDelivery` entries
- Weather: `WeatherSummary`, `TemperatureLow/High`, `Precipitation`, `Wind`

**Output:** Executive summary paragraph stored in a new `AiSummary` field on `PmDailyReport`. Highlights: total manpower, key activities, safety incidents (if any), weather impact, material deliveries.

**Provider:** OpenAI GPT-4o (TextGeneration — straightforward summarization).

**Estimated tokens:** ~1,500 input, ~300 output per report.

### 3.3 Cost code suggestion

**Trigger:** User starts entering a time entry and the cost code field is empty. Real-time API call.

**Input data gathered:**
- `TimeEntry.Description` (work description)
- `Employee.Trade` / `Employee.Classification`
- `Project.Type`
- Active cost codes for the project (from `CostCode` table, filtered by `IsActive`)
- Historical time entries for this employee on this project (last 30 days)
- **Scheduled activity context:** `PmScheduleActivity` entries assigned to the employee's crew for the given date (planned work for the day). This is the most critical context — a foreman's description ("poured slab on west side") is often ambiguous, but knowing the crew was assigned to "Level 2 Slab Pour" on the schedule disambiguates the correct cost code.
- `Phase` the crew is working in (if phases are configured for the project)

**Context structuring:**
```
<employee_context>
  Trade: Carpenter | Classification: Journeyman
  Recent cost codes (last 30 days): 03-100 (12x), 03-200 (8x), 06-100 (3x)
</employee_context>

<schedule_context>
  Assigned activities for 2026-02-16:
  - A1020 "Level 2 Slab Pour" (Phase: Structural, Cost Code: 03-300)
  - A1025 "Formwork Stripping L1" (Phase: Structural, Cost Code: 03-100)
</schedule_context>

<work_description>
  "Poured slab on west side, stripped forms on east wing"
</work_description>

<available_cost_codes>
  03-100: Concrete Formwork | 03-200: Rebar | 03-300: Concrete Placement | ...
</available_cost_codes>
```

**Output:** Ranked list of 3-5 suggested cost codes with confidence scores.

**Provider:** OpenAI GPT-4o (TextGeneration — fast response required for UX).

**Latency target:** < 2 seconds. Cache aggressively by (employee, project, date, description_hash).

**Estimated tokens:** ~800 input, ~200 output.

### 3.4 Document analysis

**Trigger:** User uploads a document (plans, specs, submittals) and clicks "Analyze".

**Input data:** Raw document bytes (PDF/image) sent via Claude's native document understanding.

**Output per document type:**

| Document Type | Analysis Output |
|---|---|
| Plan sheet (PDF) | Extracted drawing number, discipline, revision, key dimensions, referenced spec sections |
| Spec section (PDF) | Extracted CSI code, key requirements, submittal requirements, referenced standards |
| Submittal (PDF) | Product data extraction, compliance check against spec requirements |
| Contract/CO (PDF) | Extracted parties, amounts, key dates, scope description |

Results stored in `PmDocument` metadata fields and optionally linked to relevant entities (auto-create `PmSubmittal` from a submittal PDF, auto-populate `PmSpecSection` from a spec PDF).

**Provider:** Anthropic Claude (DocumentUnderstanding capability).

**Estimated tokens:** ~10,000 input (document), ~2,000 output per document.

### 3.5 Natural language search

**Trigger:** User types a query in the project search bar: "Show me all RFIs about waterproofing that are still open" or "What was the concrete pour quantity last Tuesday?"

**Architecture:**

1. **Indexing (async):** When entities are created/updated, generate embeddings via `DocumentEmbeddingConsumer` and store in `ai_embeddings` table.
2. **Query time:** Embed the user's question → cosine similarity search against stored vectors → retrieve top-N entity IDs → fetch full entities → optionally run a Claude completion to synthesize a natural language answer.

**Entities indexed:**

| Entity | Fields Embedded | Estimated Volume |
|---|---|---|
| `Rfi` | Subject + Question + Answer | ~50-200 per project |
| `PmDailyReport` | WorkNarrative + DelaysNarrative | ~200-500 per project |
| `PmCommunication` | Subject + Body | ~100-300 per project |
| `PmMeetingMinute` | MinuteText | ~50-100 per project |
| `ChangeOrder` | Title + Description + Reason | ~20-50 per project |
| `PmSubmittal` | Title + Description + SpecSectionCode | ~50-150 per project |
| `PmProjectNarrative` | All narrative fields concatenated | ~12 per project/year |

**Embedding storage:**

```csharp
public class AiEmbedding : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string EntityType { get; set; }       // "Rfi", "DailyReport", etc.
    public Guid EntityId { get; set; }
    public string EmbeddedText { get; set; }      // Source text (for reindexing)
    public float[] Vector { get; set; }           // 3072-dim (text-embedding-3-large)
    public string ModelVersion { get; set; }      // "text-embedding-3-large-v1" — tracks which model generated this vector
    public DateTime EmbeddedAt { get; set; }
}
```

EF configuration:
```
Table: ai_embeddings
Indexes: (ProjectId, EntityType), (ModelVersion, EmbeddedAt)
ModelVersion: HasMaxLength(100), required
```

**Embedding re-indexing strategy:** When a new embedding model version is deployed (e.g., upgrading from `text-embedding-3-large` to a future `text-embedding-4`), the `ModelVersion` field identifies stale embeddings. A background `EmbeddingReindexConsumer` queries all embeddings where `ModelVersion != currentModelVersion` and re-generates them from the stored `EmbeddedText`. The process is triggered by an `EmbeddingModelUpdated` event and runs with configurable batch size and throttling to avoid overwhelming the embedding API.

```csharp
// Published when embedding model config changes
public record EmbeddingModelUpdated(
    string OldModelVersion,
    string NewModelVersion,
    int BatchSize = 100,
    int DelayBetweenBatchesMs = 1000
);
```

Entity update events also trigger re-indexing — an `EntityUpdated` event publishes a `ReIndexRequest` message for the specific entity, ensuring embeddings stay current when source documents change.

**Vector search:** Use pgvector extension for PostgreSQL (cosine similarity). Keeps everything in one database — no external vector DB for on-prem simplicity.

```sql
-- pgvector cosine similarity search
SELECT entity_type, entity_id, 1 - (vector <=> $1) AS similarity
FROM ai_embeddings
WHERE project_id = $2 AND tenant_id = $3
  AND model_version = $4  -- only search embeddings from current model
ORDER BY vector <=> $1
LIMIT 10;
```

**Provider:** OpenAI (Embedding capability) for vector generation. Anthropic Claude (Analysis) for answer synthesis.

### 3.6 Change order impact analysis

**Trigger:** Change order created with `OriginatingRfiId` set, or user clicks "Analyze Impact".

**Input data gathered:**
- `ChangeOrder.Amount`, `ChangeOrder.DaysExtension`, `ChangeOrder.Description`, `ChangeOrder.Reason`
- Originating `Rfi` (if linked): question, answer, spec section, cost/schedule impact estimates
- `Subcontract` the CO belongs to: original amount, current committed amount
- `PmJobCostBudget` entries for affected cost codes: original budget, current budget, actual-to-date
- `Project.ContractAmount`, `Project.OriginalBudget`
- Previous change orders on same subcontract (pattern detection)
- **Subcontractor aggregate totals:** Total approved COs from this subcontractor across the project (count, sum, trend). A PM's first question is often "Is this the third CO from the electrician? What's my total exposure?"

**Context structuring (XML-tagged):**
```
<change_order>
  Amount: $12,500 | Days Extension: 5 | Reason: Unforeseen condition
  Description: "Additional waterproofing required at elevator pit per RFI-042"
</change_order>

<budget_data>
  Original Contract: $2,400,000
  Approved Changes: +$145,000
  Current Budget: $2,545,000
  Actual-to-Date: $1,870,000 (73.5%)
  Affected Cost Codes:
  - 07 10 00 Waterproofing: Budget $85,000, Actual $62,300 (73.3%)
</budget_data>

<subcontractor_history>
  Subcontract: Acme Waterproofing (SC-012)
  Original Amount: $85,000
  Approved COs: 2 totaling +$8,200 (this would be #3)
  Current Committed: $93,200
  Pattern: 3 COs in 4 months — scope definition gap in division 07
</subcontractor_history>

<schedule_data>
  Related Activities: A2010 "Elevator Pit Waterproofing" (5 days float)
  Critical Path Impact: No (sufficient float to absorb 5-day extension)
</schedule_data>
```

**Output:** Structured analysis:
```json
{
  "budgetImpact": {
    "currentBudgetUtilization": 0.73,
    "postChangeUtilization": 0.78,
    "affectedCostCodes": ["07 10 00"],
    "riskLevel": "Medium"
  },
  "scheduleImpact": {
    "requestedDays": 5,
    "assessedDays": 3,
    "criticalPathAffected": false,
    "mitigationSuggestions": ["Overlap framing with remaining concrete cure time"]
  },
  "subcontractorContext": {
    "totalApprovedCOs": 2,
    "totalApprovedAmount": 8200,
    "cumulativeWithThis": 20700,
    "pattern": "3 COs in 4 months — suggests scope definition gap in division 07"
  },
  "historicalContext": "This is the 3rd CO on this subcontract (total +$20,700 if approved). Pattern suggests scope definition gap in division 07.",
  "recommendation": "Approve with reduced schedule extension. Request detailed breakdown of delay claim. Consider scope review meeting with Acme Waterproofing to prevent further COs."
}
```

**Provider:** Anthropic Claude (Analysis capability — requires multi-step reasoning over financial data).

**Estimated tokens:** ~3,500 input, ~1,200 output.

### 3.7 Schedule risk prediction

**Trigger:** Schedule baseline captured, or weekly automated analysis (cron via MassTransit scheduled message).

**Input data gathered from PM module:**
- `PmScheduleActivity` entries: planned vs actual start/finish, float, percent complete, critical path flag
- `PmScheduleDependency` entries: predecessor/successor chains
- `PmDailyReport` weather data (precipitation days → weather delay correlation)
- `PmProgressEntry` trend data: planned vs actual percent complete over time
- `PmEarnedValueSnapshot`: SPI, CPI trends
- **Resource conflicts:** Cross-reference schedule activities with manpower forecasts — flag activities where required crew size exceeds available manpower for the scheduled dates
- **Material/submittal delays:** Cross-reference schedule activity start dates with `PmSubmittal` estimated delivery dates — flag activities where materials won't arrive before the scheduled start

**Context structuring (XML-tagged):**
```
<schedule_status>
  Contract Completion: 2026-08-30
  Current Projected: 2026-09-15 (+16 days)
  Critical Path: A1040 → A1050 → A1060 → A1090
</schedule_status>

<earned_value>
  SPI (3-period trend): 0.85, 0.83, 0.82 (declining)
  CPI (3-period trend): 0.91, 0.90, 0.89
</earned_value>

<critical_activities>
  A1040 "Structural Steel Erection": 45% complete, -2 days float, SPI 0.82
  A1050 "Metal Deck Install": Not started, depends on A1040, 0 days float
</critical_activities>

<resource_conflicts>
  A1040 requires crew of 10 ironworkers, but manpower forecast shows 6 available
  A1050 requires steel deck material — submittal approved, delivery est. July 15
    but activity scheduled to start July 1 (14-day material delay risk)
</resource_conflicts>

<weather_history>
  Last 30 days: 8 precipitation days (27%)
  Historical avg for this month: 5 days (17%)
  Weather delay trend: above average
</weather_history>
```

**Output:** Risk assessment per critical path activity:
```json
{
  "overallScheduleRisk": "Medium-High",
  "projectedCompletionDate": "2026-09-15",
  "contractCompletionDate": "2026-08-30",
  "projectedDelayDays": 16,
  "riskFactors": [
    {
      "activityCode": "A1040",
      "activityName": "Structural Steel Erection",
      "riskLevel": "High",
      "reason": "SPI trending at 0.82 over last 3 periods. 2 days negative float.",
      "resourceConflict": "Requires 10 ironworkers, only 6 forecasted",
      "suggestedAction": "Add second erection crew or authorize Saturday work"
    },
    {
      "activityCode": "A1050",
      "activityName": "Metal Deck Install",
      "riskLevel": "High",
      "reason": "Material delivery (July 15) conflicts with scheduled start (July 1).",
      "materialDelay": "14-day gap between scheduled start and expected delivery",
      "suggestedAction": "Expedite delivery or re-sequence with non-critical work"
    }
  ]
}
```

**Provider:** Anthropic Claude (Analysis capability).

**Estimated tokens:** ~6,000 input (large schedule with resource data), ~1,800 output.

### 3.8 Submittal log automation from spec books

**Trigger:** User uploads a project specification book PDF and clicks "Generate Submittal Log".

**Problem solved:** At project kickoff, a PE or PM manually scans the multi-hundred-page spec book to create a submittal log by finding every instance of "Submit X for approval" or similar language. This takes days of tedious, error-prone work.

**Input data:**
- Spec book PDF (multi-hundred pages, sent in chunks via Claude's document understanding)
- Project information: `Project.Name`, `Project.Number`, `Project.Type`
- Existing `PmSpecSection` entities (if any have been manually created)

**Processing approach:**
1. Split spec book into per-division/section chunks (by CSI division headers)
2. For each chunk, use Claude to extract submittal requirements: spec section code, submittal description, type (product data / shop drawing / sample / etc.), responsible party hint
3. Aggregate results and deduplicate across sections
4. Generate draft `PmSubmittal` entities in "Draft" status for PM review

**Output:** Array of draft submittals:
```json
[
  {
    "specSectionCode": "03 30 00",
    "specSectionTitle": "Cast-in-Place Concrete",
    "submittalDescription": "Concrete mix design for all structural concrete",
    "submittalType": "ProductData",
    "priority": "High",
    "suggestedResponsibleTrade": "Concrete Subcontractor"
  },
  {
    "specSectionCode": "07 92 00",
    "specSectionTitle": "Joint Sealants",
    "submittalDescription": "Product data sheets for all sealant types specified",
    "submittalType": "ProductData",
    "priority": "Medium",
    "suggestedResponsibleTrade": "Waterproofing Subcontractor"
  }
]
```

**Provider:** Anthropic Claude (DocumentUnderstanding capability — native PDF parsing).

**Estimated tokens:** ~50,000 input (large spec book, chunked), ~5,000 output. This is a one-time cost per project.

**Async:** Yes — runs via `SubmittalLogConsumer`. Typical spec book takes 2-5 minutes to process.

### 3.9 Pay application review (AIA G702/G703)

**Trigger:** Subcontractor uploads a pay application PDF, or PM clicks "AI Review" on a received pay app.

**Problem solved:** Subcontractors submit monthly pay applications (AIA G702/G703 forms). PMs and accountants must manually verify the math, check percentages against observed progress, and catch overbilling. This is time-consuming and mistakes lead to overpayment.

**Input data:**
- Pay application PDF (G702 summary + G703 schedule of values)
- `Subcontract` data: original amount, current committed, schedule of values line items
- `PmProgressEntry` data: observed percent complete for related activities
- `PmDailyReport` narratives: recent work descriptions for the subcontractor's scope
- Previous pay application data (if stored): billed-to-date progression

**Processing approach:**
1. Use Claude DocumentUnderstanding to OCR and extract the G702/G703 form data
2. Validate math: check that line-item totals sum correctly, retainage is calculated properly, and the G702 summary matches the G703 detail
3. Compare claimed percent complete against project progress observations
4. Flag discrepancies (e.g., "Sub claims 80% complete on framing, but daily reports and progress photos suggest ~65%")

**Output:**
```json
{
  "payAppSummary": {
    "applicationNumber": 5,
    "periodTo": "2026-01-31",
    "contractSum": 340000,
    "totalCompletedToDate": 238000,
    "retainageToDate": 23800,
    "currentPaymentDue": 42500
  },
  "mathValidation": {
    "isValid": true,
    "errors": []
  },
  "progressDiscrepancies": [
    {
      "lineItem": "03 - Structural Steel",
      "claimedPercent": 80,
      "observedPercent": 65,
      "varianceDollar": 5100,
      "evidence": "Daily reports from Jan 15-31 mention steel erection only on Level 1; Level 2 not started per foreman notes"
    }
  ],
  "recommendation": "Request revised application. Line item 03 appears overbilled by ~$5,100 based on field observations."
}
```

**Provider:** Anthropic Claude (DocumentUnderstanding + Analysis).

**Estimated tokens:** ~15,000 input (PDF + context), ~2,000 output.

### 3.10 Meeting minutes action item extraction

**Trigger:** Meeting transcript is saved to a `PmMeetingMinute` record (from recorded OAC meeting), or user clicks "Extract Action Items".

**Problem solved:** OAC (Owner-Architect-Contractor) meetings generate action items that get lost in lengthy minutes. PMs spend time manually parsing transcripts to identify who needs to do what by when.

**Input data:**
- `PmMeetingMinute.MinuteText` (full transcript or formatted minutes)
- `PmMeeting` metadata: date, attendees, project
- Project team roster (from `ProjectAssignment` entities) — maps mentioned names to system users
- Previous meeting's open action items (for continuity tracking)

**Output:** Array of draft action items written to `PmMeetingActionItem`:
```json
{
  "actionItems": [
    {
      "description": "Submit revised structural steel shop drawings incorporating RFI-042 response",
      "assignedToName": "Mike Torres",
      "assignedToCompany": "ABC Steel",
      "suggestedDueDate": "2026-03-01",
      "priority": "High",
      "relatedRfiNumber": "RFI-042",
      "sourceText": "Mike agreed to resubmit the shop drawings by end of next week..."
    },
    {
      "description": "Confirm elevator pit waterproofing approach with owner",
      "assignedToName": "Sarah Chen",
      "assignedToCompany": "Pitbull GC",
      "suggestedDueDate": "2026-02-28",
      "priority": "Medium",
      "sourceText": "Sarah to follow up with the owner on the waterproofing spec clarification..."
    }
  ],
  "openItemsFromPrevious": [
    {
      "originalItem": "Provide updated manpower schedule",
      "status": "Discussed — Mike said it will be ready by Friday",
      "suggestedUpdate": "Update due date to 2026-02-21"
    }
  ]
}
```

**Provider:** Anthropic Claude (Analysis capability — needs to identify action items, match names to roster, infer dates).

**Estimated tokens:** ~4,000 input (transcript + roster), ~1,500 output.

### 3.11 Safety hazard identification from site photos

**Trigger:** Site photo uploaded as part of a `PmDailyReport`, or user clicks "Safety Check" on a photo.

**Problem solved:** Daily reports include site photos, but safety violations are easy to miss in a busy PM's review. AI can flag potential OSHA violations and safety hazards that might otherwise go unnoticed until an inspector visits.

**Input data:**
- Site photo image (from `PmDailyReportPhoto` or `PmDocument`)
- Project type context: `Project.Type` (determines applicable safety standards)
- Active safety plan items (from `PmSafetyPlan` if available)

**Output:**
```json
{
  "hazardsIdentified": [
    {
      "hazardType": "Fall Protection",
      "severity": "High",
      "oshaStandard": "29 CFR 1926.501(b)(1)",
      "description": "Worker on elevated platform (~12ft) without visible fall protection harness or guardrail system",
      "location": "Upper left quadrant of photo — steel deck area",
      "suggestedAction": "Ensure all workers above 6 feet have fall protection per OSHA standards"
    },
    {
      "hazardType": "Housekeeping",
      "severity": "Low",
      "oshaStandard": "29 CFR 1926.25(a)",
      "description": "Scattered debris and loose materials on walking surface near stairwell",
      "location": "Center of photo — ground level",
      "suggestedAction": "Clear debris from walkway and establish regular housekeeping schedule"
    }
  ],
  "overallSafetyRating": "Needs Attention",
  "positiveObservations": ["Hard hats visible on all ground-level workers", "Proper barricading around excavation"]
}
```

**Provider:** Anthropic Claude (ImageAnalysis capability — strong visual reasoning about spatial relationships and safety equipment).

**Estimated tokens:** ~5,000 input (image), ~1,000 output per photo.

**Important caveats:**
- AI safety analysis is supplementary — it does not replace qualified safety personnel or formal inspections
- False positives are acceptable (better to over-flag than miss a hazard)
- Photos analyzed automatically are flagged for safety officer review, never used for automated enforcement
- Results stored on `PmDailyReportPhoto.AiSafetyAnalysis` (JSON) and `AiSafetyAnalyzedAt`

---

## 4. API Key Management

### 4.1 Per-tenant key storage

API keys are stored encrypted in the database, scoped to the tenant level. A tenant can bring their own OpenAI/Anthropic keys (reducing Pitbull's API cost) or use Pitbull-provided shared keys with usage-based billing.

```csharp
public class AiApiKey : BaseEntity
{
    public Guid TenantId { get; set; }
    public string Provider { get; set; }            // "anthropic" | "openai"
    public string EncryptedApiKey { get; set; }      // AES-256-GCM encrypted
    public string KeyFingerprint { get; set; }       // Last 4 chars for display
    public bool IsActive { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
```

EF configuration:
```
Table: ai_api_keys
Unique index: (TenantId, Provider)
EncryptedApiKey: HasMaxLength(1000)
```

### 4.2 Key resolution priority

1. Tenant-provided key (from `ai_api_keys` table)
2. Pitbull platform key (from `Anthropic:ApiKey` / `OpenAI:ApiKey` in appsettings)
3. Fail with `AI_NOT_CONFIGURED` error code

### 4.3 Encryption

Keys encrypted at rest using ASP.NET Data Protection API (DPAPI) with a tenant-scoped purpose string. The encryption key itself is derived from the `Jwt:Key` configuration value (already required, min 32 chars).

```csharp
public interface IAiKeyVault
{
    Task<Result<string>> GetDecryptedKeyAsync(Guid tenantId, string provider, CancellationToken ct);
    Task<Result> StoreKeyAsync(Guid tenantId, string provider, string apiKey, CancellationToken ct);
    Task<Result> RevokeKeyAsync(Guid tenantId, string provider, CancellationToken ct);
}
```

---

## 5. Rate Limiting and Cost Controls

### 5.1 Token budget system

Every tenant has a configurable monthly token budget. The `TokenBudgetService` enforces this before any AI call executes.

```csharp
public class AiUsageLog : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? UserId { get; set; }
    public string Provider { get; set; }          // "anthropic" | "openai"
    public string Model { get; set; }             // "claude-sonnet-4-20250514"
    public string FeatureTag { get; set; }        // "rfi-draft", "search", etc.
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public decimal EstimatedCostUsd { get; set; } // Calculated from token pricing
    public int LatencyMs { get; set; }
    public bool CacheHit { get; set; }
    public DateTime RequestedAt { get; set; }
}
```

EF configuration:
```
Table: ai_usage_logs
Indexes: (TenantId, RequestedAt), (TenantId, FeatureTag, RequestedAt)
EstimatedCostUsd: HasPrecision(10, 6)
```

### 5.2 Budget tiers

Configurable per tenant via admin settings:

| Tier | Monthly Token Budget | Approx. Monthly Cost | Target Customer |
|---|---|---|---|
| Starter | 500,000 tokens | ~$5 | Small GCs, < 5 projects |
| Professional | 5,000,000 tokens | ~$50 | Mid-size GCs, 5-20 projects |
| Enterprise | 50,000,000 tokens | ~$500 | Large GCs, 20+ projects |
| Unlimited | No limit | Usage-based | BYOK tenants with own API keys |

### 5.3 Rate limiting

Two layers of rate limiting, both enforced before the AI provider is called:

**Per-tenant:** Max 60 AI requests/minute (burst), 1,000/hour (sustained). Prevents a single tenant from monopolizing shared API keys.

**Per-user:** Max 20 AI requests/minute. Prevents individual user abuse.

**Per-feature:** Configurable per feature tag. E.g., cost code suggestions (real-time) get higher limits than batch document analysis.

Implementation via the existing `[EnableRateLimiting("api")]` pattern with a new `"ai"` policy:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("ai", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: context.User.FindFirstValue("tenant_id"),
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6
            }));
});
```

### 5.4 Cost alerting

When a tenant reaches 80% and 95% of their monthly budget, publish a notification event. The notification system (future) or email sends an alert to tenant admins.

When budget is exceeded: all AI requests return `Result.Failure("Monthly AI budget exceeded", "AI_BUDGET_EXCEEDED")`. The UI degrades gracefully — AI suggestion buttons become disabled with a tooltip explaining the limit.

---

## 6. Entity Changes

### 6.1 New entities (in Pitbull.AI module)

| Entity | Table | Purpose |
|---|---|---|
| `AiApiKey` | `ai_api_keys` | Per-tenant encrypted API keys |
| `AiUsageLog` | `ai_usage_logs` | Token usage tracking per request |
| `AiEmbedding` | `ai_embeddings` | Vector storage for semantic search (with `ModelVersion` for re-indexing) |
| `AiPromptTemplate` | `ai_prompt_templates` | Versioned prompt registry for all AI features |
| `AiFeedback` | `ai_feedback` | Human-in-the-loop feedback on AI outputs |

### 6.2 Existing entity additions

| Entity | New Field | Type | Purpose |
|---|---|---|---|
| `PmDailyReport` | `AiSummary` | `string?` | AI-generated executive summary |
| `PmDailyReport` | `AiSummarizedAt` | `DateTime?` | When summary was generated |
| `PmDailyReportPhoto` | `AiSafetyAnalysis` | `string?` | JSON safety hazard analysis result |
| `PmDailyReportPhoto` | `AiSafetyAnalyzedAt` | `DateTime?` | When safety analysis was generated |
| `ChangeOrder` | `AiImpactAnalysis` | `string?` | JSON impact analysis result |
| `ChangeOrder` | `AiAnalyzedAt` | `DateTime?` | When analysis was generated |
| `PmSchedule` | `AiRiskAssessment` | `string?` | JSON risk prediction result |
| `PmSchedule` | `AiAssessedAt` | `DateTime?` | When assessment was generated |
| `PmMeetingMinute` | `AiActionItems` | `string?` | JSON extracted action items |
| `PmMeetingMinute` | `AiExtractedAt` | `DateTime?` | When action items were extracted |

Note: `Rfi.AiSuggestedAnswer` and `Rfi.AiAnalyzedAt` already exist.

### 6.3 pgvector extension

Requires a migration to enable the extension and add the vector column:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- On ai_embeddings table:
ALTER TABLE ai_embeddings ADD COLUMN vector vector(3072);
ALTER TABLE ai_embeddings ADD COLUMN model_version varchar(100) NOT NULL DEFAULT 'text-embedding-3-large-v1';
CREATE INDEX ix_ai_embeddings_vector ON ai_embeddings
    USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ix_ai_embeddings_model_version ON ai_embeddings (model_version, embedded_at);
```

---

## 7. API Endpoints

All endpoints require `[Authorize]` and respect tenant isolation.

### 7.1 AI feature endpoints

```
POST   /api/projects/{projectId}/rfis/{rfiId}/ai/draft-answer
POST   /api/projects/{projectId}/daily-reports/{reportId}/ai/summarize
POST   /api/projects/{projectId}/daily-reports/{reportId}/photos/{photoId}/ai/safety-check
POST   /api/projects/{projectId}/change-orders/{coId}/ai/analyze-impact
POST   /api/projects/{projectId}/schedules/{scheduleId}/ai/predict-risks
POST   /api/projects/{projectId}/documents/{documentId}/ai/analyze
POST   /api/projects/{projectId}/documents/{documentId}/ai/generate-submittal-log
POST   /api/projects/{projectId}/subcontracts/{subId}/pay-apps/{payAppId}/ai/review
POST   /api/projects/{projectId}/meetings/{meetingId}/minutes/{minuteId}/ai/extract-actions
POST   /api/projects/{projectId}/ai/search
GET    /api/projects/{projectId}/ai/search?q={natural language query}
POST   /api/time-entries/ai/suggest-cost-code
POST   /api/ai/feedback
```

### 7.2 Admin endpoints

```
GET    /api/admin/ai/usage                           # Usage dashboard data
GET    /api/admin/ai/usage/by-feature                # Breakdown by feature tag
GET    /api/admin/ai/usage/by-project                # Breakdown by project
PUT    /api/admin/ai/settings                        # Update budget tier, provider prefs
POST   /api/admin/ai/api-keys                       # Store tenant API key
DELETE /api/admin/ai/api-keys/{provider}             # Revoke tenant API key
GET    /api/admin/ai/api-keys                       # List keys (fingerprint only)
GET    /api/admin/ai/prompts                         # List all prompt templates
GET    /api/admin/ai/prompts/{featureTag}/versions    # Version history for a feature
POST   /api/admin/ai/prompts                         # Create new prompt version
PUT    /api/admin/ai/prompts/{id}/activate            # Activate a prompt version
POST   /api/admin/ai/prompts/{id}/test                # Dry-run prompt against sample input
GET    /api/admin/ai/feedback/summary                # Aggregated feedback metrics
GET    /api/admin/ai/feedback?featureTag={tag}        # Raw feedback entries
POST   /api/admin/ai/embeddings/reindex              # Trigger re-indexing for stale embeddings
```

---

## 8. DI Registration

Following existing `AddPitbullModuleServices<T>` pattern:

```csharp
// Program.cs additions:

// Redis cache (wiring up existing docker-compose service)
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "pitbull:";
});

// HTTP clients for AI providers
builder.Services.AddHttpClient("Anthropic", client =>
{
    client.BaseAddress = new Uri("https://api.anthropic.com/");
    client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
});
builder.Services.AddHttpClient("OpenAI", client =>
{
    client.BaseAddress = new Uri("https://api.openai.com/");
});

// MassTransit with PostgreSQL transport
builder.Services.AddMassTransit(x =>
{
    x.AddConsumersFromNamespaceContaining<RfiDraftConsumer>();
    x.UsingPostgres((context, cfg) =>
    {
        cfg.UseDbContext<PitbullDbContext>();
        cfg.ConfigureEndpoints(context);
    });
});

// AI module services (auto-discovered via convention)
builder.Services.AddPitbullModuleServices<AiOrchestrationService>();
```

---

## 9. Configuration

```json
// appsettings.json additions:
{
  "ConnectionStrings": {
    "Redis": "localhost:6379"
  },
  "Anthropic": {
    "ApiKey": "",
    "DefaultModel": "claude-sonnet-4-20250514"
  },
  "OpenAI": {
    "ApiKey": "",
    "DefaultModel": "gpt-4o",
    "EmbeddingModel": "text-embedding-3-large"
  },
  "AI": {
    "DefaultMonthlyTokenBudget": 5000000,
    "MaxRequestTokens": 16000,
    "CacheEnabled": true,
    "AsyncProcessingEnabled": true,
    "EmbeddingDimensions": 3072,
    "EmbeddingModelVersion": "text-embedding-3-large-v1"
  }
}
```

Environment variable overrides (for on-prem deployments):
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
ConnectionStrings__Redis=redis-host:6379
AI__DefaultMonthlyTokenBudget=50000000
AI__EmbeddingModelVersion=text-embedding-3-large-v1
```

---

## 10. Migration from Existing AiInsightsService

The existing `AiInsightsService` in `Pitbull.Api/Services/` is the prototype. Migration path:

1. Move project health analysis logic into a new `ProjectHealthAnalyzer` in `Pitbull.AI/Services/`
2. Route it through `AiOrchestrationService` (gains caching, budget tracking, provider abstraction)
3. Deprecate `IAiInsightsService` and update `AiInsightsController` to call the new service
4. Keep the same response contract (`AiProjectSummaryResult`) for frontend compatibility

---

## 11. Implementation Phases

### Phase 1: Foundation (2 weeks)
- [ ] Create `Pitbull.AI` module with provider abstraction
- [ ] Implement `AnthropicProvider` and `OpenAiProvider`
- [ ] Wire up Redis caching
- [ ] Implement `TokenBudgetService` and `AiUsageLog` entity
- [ ] Implement `AiApiKey` entity and `AiKeyVault`
- [ ] Implement `AiPromptTemplate` entity and `PromptRegistryService`
- [ ] Implement `AiFeedback` entity and feedback API
- [ ] Add AI rate limiting policy
- [ ] Migrate existing `AiInsightsService`

### Phase 2: Core Use Cases (3 weeks)
- [ ] RFI draft generation (builds on existing `AiSuggestedAnswer` field)
- [ ] Daily report summarization (add MassTransit, first consumer)
- [ ] Cost code suggestion (real-time endpoint, enriched with `PmScheduleActivity` context)
- [ ] Change order impact analysis (with subcontractor aggregate context)

### Phase 3: Search and Documents (3 weeks)
- [ ] Enable pgvector extension with `ModelVersion` field
- [ ] Implement `EmbeddingService` and `DocumentEmbeddingConsumer`
- [ ] Implement `EmbeddingReindexConsumer` for model version upgrades
- [ ] Build entity indexing pipeline (RFIs, daily reports, communications, etc.)
- [ ] Natural language search endpoint
- [ ] Document analysis (PDF upload → structured extraction)

### Phase 4: Predictive and Advanced Analysis (3 weeks)
- [ ] Schedule risk prediction (with resource conflict and material delay detection)
- [ ] Submittal log automation from spec books
- [ ] Pay application review (AIA G702/G703)
- [ ] Meeting minutes action item extraction

### Phase 5: Safety and Admin (2 weeks)
- [ ] Safety hazard identification from site photos
- [ ] Admin usage dashboard
- [ ] Prompt registry admin UI
- [ ] Feedback analytics dashboard
- [ ] Budget alerting
- [ ] Cost trend anomaly detection (stretch goal)

---

## 12. Cost Estimates

Per-project monthly costs assuming a mid-size commercial project (~$10M contract):

| Feature | Calls/Month | Avg Tokens/Call | Monthly Tokens | Est. Cost |
|---|---|---|---|---|
| RFI drafts | 20 | 2,800 | 56,000 | $0.30 |
| Daily report summaries | 22 | 1,800 | 39,600 | $0.10 |
| Cost code suggestions | 500 | 1,000 | 500,000 | $1.25 |
| Change order analysis | 5 | 4,700 | 23,500 | $0.18 |
| Document analysis | 10 | 12,000 | 120,000 | $1.50 |
| Natural language search | 100 | 1,500 | 150,000 | $0.75 |
| Schedule risk prediction | 4 | 7,800 | 31,200 | $0.25 |
| Project health analysis | 30 | 3,000 | 90,000 | $0.50 |
| Embedding generation | 200 | 500 | 100,000 | $0.01 |
| Submittal log automation | 1 | 55,000 | 55,000 | $0.70 |
| Pay application review | 1 | 17,000 | 17,000 | $0.22 |
| Meeting minutes extraction | 4 | 5,500 | 22,000 | $0.17 |
| Safety photo analysis | 40 | 6,000 | 240,000 | $3.00 |
| **Total per project** | | | **~1.44M** | **~$8.93** |

A GC with 15 active projects: ~$134/month in AI API costs. Well within the Professional tier budget. The increase over the original estimate ($4.40 → $8.93) is driven primarily by safety photo analysis (high image token cost) and the richer context data for cost code suggestions and schedule risk prediction.
