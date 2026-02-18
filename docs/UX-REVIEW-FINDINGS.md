# UX Review Findings

## CRITICAL
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/search/page.tsx`: Search results render backend-provided `result.url` directly; cost code results currently point to `/cost-codes/{id}` but there is no matching detail page route. This creates dead links from global search/Cmd+K flows. Fix: add a cost code detail route or map cost code results to `/cost-codes` with pre-filter/query params.

## HIGH
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/register/page.tsx`: Terms of Service and Privacy links use `href="#"` (dead links). Fix: wire to real legal pages/routes.
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/register/page.tsx`: Registration still contains `TODO` for sending invite emails, so the final step implies behavior that is not actually completed. Fix: either implement invite send or remove/disable the step until implemented.
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/register/page.tsx` and `src/Pitbull.Web/pitbull-web/src/app/(auth)/signup/page.tsx`: Duplicate registration flows with different UX/behavior (`/register` routes to `/`, `/signup` routes to `/settings/company/setup` and sends invitations). Fix: consolidate to one flow and one route; keep behavior consistent.
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/verify-email/page.tsx`: Page is explicitly a placeholder (“coming soon”) and does not verify token/email. Fix: call verify endpoint, handle success/error states, and show retry/resend actions.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/search/page.tsx`: Sort toggle UI changes state but sort is not actually applied to `filteredResults` anymore. Fix: reintroduce sort logic or remove the control.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/search/page.tsx`: Search request failure is silently swallowed (`catch { setResults([]) }`) with no user-facing error. Fix: show toast/inline error and allow retry.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/api-keys/page.tsx`, `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/compliance/page.tsx`, `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/pay-periods/page.tsx`: Large tables render without horizontal overflow container or dedicated mobile card fallback, causing cramped/clipped data on small screens. Fix: wrap tables in `overflow-x-auto` and/or add mobile card layout.

## MEDIUM
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/api-keys/page.tsx`: Icon-only action buttons rely on `title` only (revoke/delete/copy), missing explicit accessible name. Fix: add `aria-label` or visible/sr-only text.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/equipment/page.tsx`: Icon-only edit/delete buttons in mobile cards have no `aria-label`/sr-only text. Fix: add accessible labels.
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/forgot-password/page.tsx`: Invalid email submission returns early with no validation message/feedback. Fix: show inline error or toast when format check fails.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/users/page.tsx`: Invite dialog only validates non-empty email; no explicit format validation before submit. Fix: add client-side email format check and inline error message.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/users/page.tsx`: Invitation/role fetch failures are silently ignored, which can hide authorization or API regressions. Fix: show non-blocking warning toast/banner and retry affordance.
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/signup/page.tsx`, `src/Pitbull.Web/pitbull-web/src/app/(auth)/register/page.tsx`, `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/new/page.tsx`: Mutable list rendering uses index keys (`key={index}`), which can cause input state jumps and React warnings during add/remove/reorder. Fix: use stable IDs for list items.

## LOW
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/plans-specs/page.tsx`: Search placeholder says `Ctrl+K` while global pattern is Cmd/Ctrl+K. Fix: use platform-aware hint (`Cmd/Ctrl+K`) for consistency.
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/reports/equipment/page.tsx` and `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/reports/project-profitability/page.tsx`: Breadcrumb “Reports” links to `/reports/labor-cost` instead of a neutral reports index, creating confusing navigation semantics. Fix: add `/reports` index page or remove the linked parent.
- `src/Pitbull.Web/pitbull-web/src/components/project-management/project-module-page.tsx`: Loading/empty/error states are plain text only (no skeleton/actionable empty-state CTA). Fix: use shared `TableSkeleton`/`EmptyState` components for consistency.
