# Spec Consistency Review

Date: 2026-02-19  
Scope: Cross-spec review of:
- `docs/plans/ONBOARDING-FLOW-V2.md`
- `docs/plans/DATA-FLOW-ARCHITECTURE.md`
- `docs/plans/AI-AGENT-ONBOARDING-DESIGN.md`
- `docs/plans/AP-AR-FOUNDATION-SPEC.md`
- `docs/plans/GL-ACCOUNTING-SPEC.md`
- `docs/plans/WIP-SCHEDULE-SPEC.md`

## Executive Summary
The specs are directionally aligned, but there are several material inconsistencies that will create implementation churn if unresolved: duplicated WIP domain models, conflicting vendor/AP assumptions, inconsistent GL module naming, and split API namespaces for similar workflows. There are also missing handoff contracts between AI-produced artifacts and finance modules.

## 1) Entity Name Conflicts / Inconsistencies

1. WIP model duplication (`WipSnapshot*` vs `WipSchedule*`)
- `docs/plans/WIP-SCHEDULE-SPEC.md:145` defines `WipSnapshot`/`WipSnapshotLine` as canonical period artifact.
- `docs/plans/GL-ACCOUNTING-SPEC.md:974` defines `WipSchedule`/`WipScheduleLine` for the same functional role.
- Risk: parallel implementations and divergent lifecycle/status logic.

2. GL module identity mismatch (`Pitbull.Accounting` vs `Pitbull.GL`)
- `docs/plans/GL-ACCOUNTING-SPEC.md:6` targets `Pitbull.Accounting`.
- `docs/plans/DATA-FLOW-ARCHITECTURE.md:980` proposes `src/Modules/Pitbull.GL/`.
- Risk: project structure ambiguity, Docker/registration mistakes, migration path confusion.

3. Vendor model mismatch across specs
- `docs/plans/AP-AR-FOUNDATION-SPEC.md:28` introduces normalized `Vendor` master.
- `docs/plans/DATA-FLOW-ARCHITECTURE.md:808` says no vendor master exists and subcontract is vendor record.
- `docs/plans/ONBOARDING-FLOW-V2.md:441` says no separate vendor record required Day 1.
- Risk: inconsistent FK strategy (`Subcontract.VendorId`) and downstream AP integration assumptions.

4. Predictive/approval draft entity vocabulary divergence
- `docs/plans/DATA-FLOW-ARCHITECTURE.md:1149` introduces `PredictiveDraft`.
- `docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:1052` introduces `PendingApproval`.
- Risk: two overlapping abstractions for “AI proposed record pending human action.”

5. AP invoice/payment terminology drift
- AP spec uses `ApInvoice` (`docs/plans/AP-AR-FOUNDATION-SPEC.md:202`).
- AI spec uses generic `Invoice` and `SubcontractorPayment` in predictive sections (`docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:634`, `docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:1259`).
- Data Flow also references `SubcontractorPayment` (`docs/plans/DATA-FLOW-ARCHITECTURE.md:1103`).
- Risk: mismatched DTO/event contracts and unnecessary translation layers.

## 2) Missing Cross-References

1. AP/AR spec under-references GL posting contract
- AP/AR mentions “postings” but does not define explicit event names/GL handoff contract (`docs/plans/AP-AR-FOUNDATION-SPEC.md:436`).
- GL spec already defines event-driven posting expectations (`docs/plans/GL-ACCOUNTING-SPEC.md:865`).
- Gap: AP/AR should explicitly reference GL event schema and posting states.

2. WIP spec contains stale cross-reference
- `docs/plans/WIP-SCHEDULE-SPEC.md:8` says GL spec was not found.
- GL spec now exists at `docs/plans/GL-ACCOUNTING-SPEC.md`.
- Gap: stale note implies obsolete dependency assumptions.

3. Data Flow spec frames GL as future-only
- `docs/plans/DATA-FLOW-ARCHITECTURE.md:856` section title is “Future: GL Integration Points”.
- Conflicts with current presence of full GL design spec and APIs.
- Gap: should link to GL spec and mark what is still future vs now designed.

4. AI onboarding references prior onboarding source instead of V2 plan
- `docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:293` references `CUSTOMER-ONBOARDING-FLOW.md`.
- Current onboarding plan in this review is V2 (`docs/plans/ONBOARDING-FLOW-V2.md`).
- Gap: risk of two diverging onboarding timelines.

## 3) API Endpoint Naming Consistency

1. Payment application endpoint style differs from dominant naming pattern
- `docs/plans/ONBOARDING-FLOW-V2.md:990` uses `POST /api/paymentapplications` (non-kebab style).
- AP/AR and GL specs predominantly use kebab-case resources (for example `/api/ap/payment-runs`, `/api/gl/journal-entries`).
- Recommendation: standardize on one convention (prefer kebab-case) and document legacy aliases if required.

2. WIP endpoint namespace split across two specs
- WIP spec uses `/api/wip/...` (`docs/plans/WIP-SCHEDULE-SPEC.md:394`).
- GL spec uses `/api/gl/wip/...` (`docs/plans/GL-ACCOUNTING-SPEC.md:1396`).
- Risk: duplicate controllers or confusing ownership boundaries.

3. Customer naming mismatch between entity and endpoint
- AP/AR entity is `CustomerOwner` (`docs/plans/AP-AR-FOUNDATION-SPEC.md:121`) but API uses `/api/customers` (`docs/plans/AP-AR-FOUNDATION-SPEC.md:335`).
- Not inherently wrong, but should be intentional and documented as an alias to avoid DTO drift.

## 4) Conflicting Business Rules

1. GL existence conflict
- Onboarding states GL module does not exist (`docs/plans/ONBOARDING-FLOW-V2.md:499`).
- GL spec defines full accounting module scope (`docs/plans/GL-ACCOUNTING-SPEC.md:1`).
- Resolution needed: distinguish “not in production yet” vs “not designed”.

2. AP source-of-truth conflict (Pay App-driven vs PO/Invoice-driven)
- Data Flow proposes payment-app approval/payment as AP posting trigger (`docs/plans/DATA-FLOW-ARCHITECTURE.md:913`).
- AP/AR foundation centers AP on PO -> Receipt -> `ApInvoice` 3-way match (`docs/plans/AP-AR-FOUNDATION-SPEC.md:177`, `docs/plans/AP-AR-FOUNDATION-SPEC.md:202`).
- GL spec supports both AP and Contracts-triggered AP impact (`docs/plans/GL-ACCOUNTING-SPEC.md:878`, `docs/plans/GL-ACCOUNTING-SPEC.md:911`).
- Risk: duplicate AP liabilities if both streams post without explicit precedence rules.

3. Financial reversal semantics need harmonization
- AI spec states approved AI-created financial records follow soft-delete + reversal approach (`docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:660`, `docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:663`).
- GL spec defines explicit JE lifecycle (`Void`, `Reverse`) (`docs/plans/GL-ACCOUNTING-SPEC.md:1326`, `docs/plans/GL-ACCOUNTING-SPEC.md:1327`).
- Risk: “soft-delete” language may conflict with immutable accounting expectations.

## 5) Data Flow Gaps (Produced But Not Clearly Consumed)

1. `FileAnalysis` output lacks explicit AP/AR consumer contract
- Produced in AI spec (`docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:1095`).
- AP/AR spec has OCR/matching goal but no explicit `FileAnalysis` ingestion contract/event.
- Gap: define handoff (`FileAnalysisCompleted -> ApInvoiceDraftCreated`).

2. `ArCollectionActivity` has no downstream consumer described
- Defined at `docs/plans/AP-AR-FOUNDATION-SPEC.md:307`.
- No explicit reporting/forecasting consumer in GL/WIP/Data Flow docs.
- Gap: connect to cash-flow forecast and collections KPIs.

3. `WipAdjustmentBatch` appears in WIP diagram but no dedicated API or lifecycle definition
- Defined in diagram (`docs/plans/WIP-SCHEDULE-SPEC.md:343`, `docs/plans/WIP-SCHEDULE-SPEC.md:372`).
- API surface does not expose/manage this artifact directly.
- Gap: either formalize as first-class entity or collapse into journal-post response model.

4. `PredictiveDraft` contract is not connected to AI approval endpoints
- Data Flow defines `PredictiveDraft` (`docs/plans/DATA-FLOW-ARCHITECTURE.md:1149`).
- AI spec approval API is `PendingApproval`-centric (`docs/plans/AI-AGENT-ONBOARDING-DESIGN.md:231`).
- Gap: unifying acceptance/rejection workflow for predictive records.

## 6) Missing Predictive UX Opportunities

1. AP payment discount optimization
- Missing proactive suggestion for early-payment discount capture (`2/10 Net 30`) in AP payment run generation.

2. Vendor compliance-to-cash impact prediction
- Lien waiver/insurance expiry exists as gating logic, but no predictive “days-to-blocked-payment” alert tied to scheduled payment runs.

3. WIP and GL close-readiness convergence
- WIP has its own alerts and GL has close-readiness dashboards, but no single predictive close cockpit combining WIP stale estimates, AP cutoff risk, AR aging deterioration, and unposted journals.

4. Retainage release prediction
- Retention entities exist but no proactive release recommendation engine (for both AR and AP) based on completion thresholds and closeout docs.

5. Cross-book anomaly preemption
- Dual-book reconciliation exists in GL, but no predictive warning for likely GAAP vs job-cost divergence before period close.

## Recommended Normalization Decisions

1. Pick one WIP canonical model and one API namespace
- Option A: WIP lives under GL (`WipSchedule*`, `/api/gl/wip/...`).
- Option B: WIP is standalone (`WipSnapshot*`, `/api/wip/...`) with explicit GL posting integration.
- Do not keep both.

2. Standardize module naming now
- Choose `Pitbull.Accounting` or `Pitbull.GL` and update all specs.

3. Publish a shared finance event contract appendix
- Authoritative event names, idempotency keys, and posting precedence across Contracts/AP/AR/GL.

4. Unify AI draft lifecycle model
- Either merge `PredictiveDraft` and `PendingApproval` or define strict boundaries and conversion flow.

5. Add a “Spec Canonical Glossary” section to each finance-related spec
- Canonical terms: `Vendor`, `CustomerOwner` (or `Customer`), `ApInvoice`, `ArBilling`, `PaymentApplication`, `JournalEntry`, WIP entity names.

## Priority Fix Order

1. Resolve WIP model + API ownership conflict.
2. Resolve AP source-of-truth/posting precedence conflict.
3. Resolve vendor normalization migration rule across onboarding/data flow/AP.
4. Normalize module naming (`Pitbull.Accounting` vs `Pitbull.GL`).
5. Harmonize AI predictive/approval entity model and contracts.
