# Contracts / AIA billing

## User POV

I enter as an executive or contract admin, open Owner Contracts and Billing Applications, open one application, and confirm the AIA G702 summary (contract sum, change orders, completed to date, retainage, payment due, status) makes sense. I also see the subcontracts surface. I don't create, approve, or certify billing in a smoke check.

## How it works (source-verified 2026-10-07, origin/main)

- **Owner (AIA) side.** Web `/billing/contracts` ("Owner Contracts"), `/billing/contracts/{id}`, `/billing/applications` ("Billing Applications", AIA G702), `/billing/applications/{id}` (G702 summary), `/billing/applications/{id}/g702`, and `/billing/aging`. API `src/Pitbull.Api/Controllers/OwnerContractsController.cs`: `GET /api/owner-contracts`, `GET /{id}`, `GET /{ownerContractId}/sov`. API `BillingApplicationsController.cs`: `GET /api/billing-applications`, `GET /{id}`.
- **Billing lifecycle mutations:** `POST /api/billing-applications`, `/{id}/recalculate`, line `PUT`s, `submit-for-review`, `approve`, `reject`, `submit-to-owner`, `return-to-draft`, `architect-certified`, `disputed`, `resolve-dispute`, `payment-due`, `partially-paid`, `paid`, and `void`.
- **Subcontract side.** Web `/contracts` is subcontracts ("Contracts: Manage subcontracts, change orders, and payment applications"), with `/contracts/{id}`, `/contracts/{id}/sov`, `/contracts/{id}/change-orders`, `/contracts/{id}/payment-applications`, plus `/payment-applications` and `/payment-applications/{id}`. API: `/api/subcontracts` (alias `/api/contracts`), `/api/paymentapplications`. `/contracts` is **not** the owner/AIA contract list.

## Live recipe (read-only)

1. `doctor.ps1`.
2. API as CEO (`demo-role-login {"role":"ceo"}`): `GET /api/owner-contracts?page=1&pageSize=25`, `GET /api/owner-contracts/{id}/sov`, `GET /api/billing-applications?page=1&pageSize=25`, `GET /api/billing-applications/{id}`, and `GET /api/subcontracts`.
3. UI as `ceo@demo.local`: open `/billing/contracts` and assert "Owner Contracts" plus totals (live: 14 contracts, $105,060,000.00). Open `/billing/applications` and assert the G702 list. Open `/billing/applications/{id}` with an ID from the API list and assert "Application #N" with the G702 Summary lines. Then open `/contracts` (subcontract totals).

## Gotchas

- Billing application rows are not anchor links, so take the ID from the API list (the same CEO saw the same app in UI on 2026-10-07). For other entities, prefer IDs from the UI because of `X-Company-Id` scope.
- Demo principals get `403 DEMO_READ_ONLY` on financial mutations. Do not use mutations as a smoke check. `role-workflows.spec.ts` L4/L5/L6 create billing apps, pay apps, and change orders.
- Billing visibility is role-dependent. Compare only against an expectation set by the current app or test.
- Never clean up by bare process name, and never delete evidence.