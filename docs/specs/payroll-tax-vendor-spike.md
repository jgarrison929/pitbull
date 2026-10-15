# Spike: payroll tax vendor (P2)

**Date:** 2026-09-02
**Status:** Decision recorded
**Related:** docs/specs/payroll-module-spec.md section 6 and P2

## What Pitbull owns

Pitbull is the system of record for:

- Hours (time entries, ST/OT/DT, job, cost code)
- Union / CBA wage packages and date-effective rates
- Certified payroll (persisted WH-347 lines, Statement of Compliance, prevailing-wage validation)

Pitbull is **not** the system of record for US payroll tax content.

## What the tax vendor owns

Federal, state, and local withholding; FICA EE/ER; FUTA; SUTA; reciprocity / convenience-of-employer; annual table updates.

Automatic updates = vendor ingest into TaxTableVersion (metadata: vendor, jurisdiction, effective date, content hash, imported-at). Not an IRS Publication 15-T scrape. Not a human spreadsheet in this repo. Billing TaxJurisdiction / TaxRate stay sales tax.

## Options considered

| Vendor class | Shape | Fit for Pitbull now |
|--------------|-------|---------------------|
| **Check-class embeddable** | Embedded payroll/tax SoR. Pitbull posts hours and components; vendor returns tax lines and net. Local tax tables optional. | Best default for this product size. Fastest path to a real net without staffing a tax content team. |
| **Symmetry-class engine** | In-process / sidecar tax engine with licensed content. Pitbull remains payroll SoR and calls the engine per slip. | Better if we must keep paycheck SoR in Pitbull and already have (or will buy) a Symmetry/Vertex license. No code in this repo currently points at Symmetry. |
| **Vertex-class engine** | Same shape as Symmetry: licensed content, engine call. | Overkill until volume or multi-jurisdiction complexity justifies it. |
| **ADP / Paychex as SoR** | Full payroll SoR. Pitbull becomes an hours + certified feeder. | Loses first-party union package and certified control we just built. Export-only later, not the v1 tax pack. |

Do **not** build a 3,000-jurisdiction calculator. Do **not** scrape IRS or state DOR sites.

## Decision

**Default: Check-class embeddable adapter (IPayrollTaxEngine + CheckPayrollTaxEngine).**

Reasons:

1. Product size is a construction ERP with a first-party union + certified module, not a payroll-tax company.
2. Repo has no Symmetry/Vertex client, SDK, or license hook.
3. Check-class keeps tax SoR outside Pitbull while hours/union/certified stay first-party.
4. TaxTableVersion still exists as ingest metadata (which vendor snapshot applied). Check-class does not require storing local percentage tables.

Revisit Symmetry-class only if we later need Pitbull to remain paycheck SoR with in-process content and we purchase that license.

## Adapter contract

IPayrollTaxEngine (overlay pack us_tax):

- Inputs: slip earnings, W-4 (filing status, additional withholding, exempt), work-state (Project.State), residence-state (EmployeeTaxCompliance.ResidenceState), optional TaxTableVersionId.
- Outputs: pay components (FIT, SIT, local, FICA EE/ER, FUTA, SUTA) and net-by-employee.
- PayrollRunService calls the adapter. It must not if (usa) tax math.
- Fail closed without credentials: no 7.65% FICA, no 12% withholding, no invented WH-347 tax columns.
- Current stub does **not** call live APIs. Until a real client is wired, generate keeps TotalNet = TotalGross and labels net a **proxy**.

## Wiring

- Program.cs: Configure<PayrollTaxOptions>(Payroll:Tax) + AddUsTaxOverlayPack().
- Unconfigured vendor (default): skip tax, proxy net.
- Vendor selected without ApiKey: generate fails TAX_VENDOR_NOT_CONFIGURED.
- Vendor selected with key on the stub: generate fails TAX_VENDOR_NOT_IMPLEMENTED (no live call, no fake percents).
