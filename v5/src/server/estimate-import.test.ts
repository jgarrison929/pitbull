import { readFileSync } from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  companies,
  costEntries,
  costItems,
  jobs,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import { buildWbsMoney, SHB_CSV, SHB_FIXTURE } from "@/lib/budget";
import { seedId } from "@/seed";
import { approveEstimate } from "./estimate";
import { importEstimateCsv } from "./estimate-import";
import { createSandbox } from "./sandbox";

const db = getDb();
const created: string[] = [];
const fixture = (name: string) =>
  readFileSync(new URL(`../../tests/fixtures/${name}`, import.meta.url), "utf8");
const HARBOR = "26-010";

async function sandbox() {
  const companyId = await createSandbox();
  created.push(companyId);
  return companyId;
}

async function tree(companyId: string, jobNumber = HARBOR) {
  const [job] = await db!
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)));
  const items = await db!
    .select()
    .from(costItems)
    .where(eq(costItems.jobId, job.id))
    .orderBy(asc(costItems.path));
  const byCode = Object.fromEntries(items.map((i) => [i.code, i]));
  return { job, items, byCode, money: buildWbsMoney(items) };
}

describe.skipIf(!db)("importEstimateCsv", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("imports SHB onto an empty draft job as Current Estimate only", async () => {
    const companyId = await sandbox();
    const harbor = await tree(companyId);
    await db!.insert(jobs).values({
      ...harbor.job,
      id: crypto.randomUUID(),
      number: "26-099",
      estimateSource: "seed",
    });

    const r = await importEstimateCsv(companyId, "26-099", fixture("shb-estimate.csv"));
    expect(r).toMatchObject({ ok: true, inserted: 6, revised: 0, removed: 0, unchanged: 0 });
    expect(r.summary).toContain("$86,750.00");
    expect(r.summary).not.toMatch(/¢/);

    const after = await tree(companyId, "26-099");
    expect(after.job.estimateSource).toBe("csv");
    expect(after.money.job).toMatchObject({
      obCents: 0,
      cbCents: 0,
      ceCents: SHB_FIXTURE.jobTotalCents,
      ce: SHB_FIXTURE.categories,
      mhMilli: SHB_FIXTURE.jobMhMilli,
    });
    expect(after.byCode["02-100"].parentId).toBe(after.byCode["02"].id);
    expect(after.byCode["02"]).toMatchObject({ path: "/02/", unit: "", isLeaf: false });
    for (const i of after.items)
      expect(i.plannedFinishOn > i.plannedStartOn).toBe(true);
  });

  it("re-importing the seeded SHB file on Harbor changes nothing", async () => {
    const companyId = await sandbox();
    const before = await tree(companyId);
    const r = await importEstimateCsv(companyId, HARBOR, SHB_CSV);
    expect(r).toMatchObject({ ok: true, inserted: 0, revised: 0, removed: 0, unchanged: 6 });
    if (!r.ok) return;
    expect([...r.preservedIds].sort()).toEqual(before.items.map((i) => i.id).sort());
    expect((await tree(companyId)).items).toEqual(before.items);
  });

  it("after seed history Harbor still imports the awkward M2 fixture (10,071,336¢)", async () => {
    // createSandbox runs seedActionHistory (Harbor estimate.importCsv, no claim lock).
    const companyId = await sandbox();
    const [claim] = await db!
      .select()
      .from(progressClaims)
      .where(eq(progressClaims.id, seedId(companyId, "claim:harbor:period-1")));
    expect(claim.status).toBe("draft");

    const r = await importEstimateCsv(
      companyId,
      HARBOR,
      fixture("awkward-estimate.csv"),
    );
    expect(r).toMatchObject({ ok: true });
    expect(r.summary).not.toMatch(/locked progress claim/i);
    if (!r.ok) return;
    expect(r.totals.ceCents).toBe(10_071_336);
    const after = await tree(companyId);
    expect(after.job.estimateStatus).toBe("draft");
    expect(after.money.job).toMatchObject({
      obCents: 0,
      cbCents: 0,
      ceCents: 10_071_336,
    });
  });

  it("revises a quantity in place, keeping ids and draft claim lines", async () => {
    const companyId = await sandbox();
    const excavationId = seedId(companyId, "cost:harbor:02-100");
    const lineId = seedId(companyId, "claim-line:harbor:02-100");

    const r = await importEstimateCsv(companyId, HARBOR, fixture("shb-qty-1000.csv"));
    expect(r).toMatchObject({ ok: true, inserted: 0, revised: 1, removed: 0, unchanged: 5 });
    const mid = await tree(companyId);
    expect(mid.money.job.ceCents).toBe(8_460_000);
    expect(mid.byCode["02-100"]).toMatchObject({
      id: excavationId,
      budgetQtyMilli: 1_000_000,
      ceLaborCents: 450_000,
      ceEquipmentCents: 625_000,
      obLaborCents: 0,
      cbLaborCents: 0,
    });
    expect(mid.money.byId[mid.byCode["02"].id]).toMatchObject({
      ceCents: 3_195_000,
      mhMilli: 114_000,
      qtyMilli: null,
    });
    const [line] = await db!
      .select()
      .from(progressClaimLines)
      .where(eq(progressClaimLines.id, lineId));
    expect(line.costItemId).toBe(excavationId);

    await importEstimateCsv(companyId, HARBOR, SHB_CSV);
    const back = await tree(companyId);
    expect(back.money.job.ceCents).toBe(SHB_FIXTURE.jobTotalCents);
    expect(back.money.byId[back.byCode["02"].id]).toMatchObject({
      ceCents: 3_410_000,
      mhMilli: 124_000,
    });
  });

  it("writes nothing when the file has errors", async () => {
    const companyId = await sandbox();
    const before = await tree(companyId);
    const r = await importEstimateCsv(companyId, HARBOR, fixture("shb-bad.csv"));
    expect(r).toMatchObject({ ok: false, reason: "invalid_csv" });
    expect(r.summary).toContain("2 errors — see the list below");
    expect(r.ok ? [] : r.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 4,
          column: "qty",
          message: expect.stringMatching(/plain number/),
        }),
        expect.objectContaining({
          line: 7,
          column: "code",
          message: expect.stringMatching(/already on line 6/),
        }),
      ]),
    );
    expect(await tree(companyId)).toEqual(before);
  });

  it("drops and restores a summary without losing the leaves under it", async () => {
    const companyId = await sandbox();
    const before = await tree(companyId);
    const flat = SHB_CSV.replace("02,,Earthwork,,,,,,,\n", "").replace(
      /\n(02-\d+),02,/g,
      "\n$1,,",
    );

    const r = await importEstimateCsv(companyId, HARBOR, flat);
    expect(r).toMatchObject({ ok: true, inserted: 0, revised: 2, removed: 1, unchanged: 3 });
    const mid = await tree(companyId);
    expect(mid.byCode["02"]).toBeUndefined();
    expect(mid.byCode["02-100"]).toMatchObject({
      id: before.byCode["02-100"].id,
      parentId: null,
      path: "/02-100/",
      depth: 0,
    });
    expect(mid.money.job.ceCents).toBe(SHB_FIXTURE.jobTotalCents);
    const lines = await db!
      .select()
      .from(progressClaimLines)
      .where(eq(progressClaimLines.costItemId, before.byCode["02-100"].id));
    expect(lines).toHaveLength(1);

    const back = await importEstimateCsv(companyId, HARBOR, SHB_CSV);
    expect(back).toMatchObject({ ok: true, inserted: 1, revised: 2, removed: 0 });
    const after = await tree(companyId);
    expect(after.byCode["02-100"]).toMatchObject({
      id: before.byCode["02-100"].id,
      parentId: after.byCode["02"].id,
      path: "/02/02-100/",
    });
  });

  it("refuses to drop a code that has field history, and writes nothing", async () => {
    const companyId = await sandbox();
    const excavationId = seedId(companyId, "cost:harbor:02-100");
    await db!.insert(costEntries).values({
      id: crypto.randomUUID(),
      companyId,
      costItemId: excavationId,
      kind: "other",
      amountCents: 12_500,
      note: "dozer rental",
    });
    const before = await tree(companyId);
    const dropped = SHB_CSV.replace(/\n02-100,[^\n]*/, "");

    const r = await importEstimateCsv(companyId, HARBOR, dropped);
    expect(r).toMatchObject({ ok: false, reason: "field_history" });
    expect(r.summary).toContain("1 error — see the list below");
    expect(r.ok ? [] : r.errors).toEqual([
      expect.objectContaining({
        message: "02-100 has 1 cost entry, so the file cannot leave it out.",
      }),
    ]);
    expect(await tree(companyId)).toEqual(before);

    const revised = await importEstimateCsv(companyId, HARBOR, fixture("shb-qty-1000.csv"));
    expect(revised).toMatchObject({ ok: true, revised: 1 });
  });

  it("refuses a job with a locked claim before reading the file", async () => {
    const companyId = await sandbox();
    await db!
      .update(progressClaims)
      .set({ status: "locked", lockedAt: new Date() })
      .where(eq(progressClaims.id, seedId(companyId, "claim:harbor:period-1")));
    const before = await tree(companyId);
    const r = await importEstimateCsv(companyId, HARBOR, fixture("shb-bad.csv"));
    expect(r).toMatchObject({ ok: false, reason: "locked_claim" });
    expect(await tree(companyId)).toEqual(before);
  });

  it("refuses after approve and leaves Original Budget frozen", async () => {
    const companyId = await sandbox();
    expect(await approveEstimate(companyId, HARBOR)).toMatchObject({
      ok: true,
      originalBudgetCents: SHB_FIXTURE.jobTotalCents,
    });
    const before = await tree(companyId);
    const r = await importEstimateCsv(companyId, HARBOR, fixture("shb-qty-1000.csv"));
    expect(r).toMatchObject({ ok: false, reason: "already_approved" });
    expect(r.summary).toContain("already approved");
    const after = await tree(companyId);
    expect(after).toEqual(before);
    expect(after.money.job).toMatchObject({
      obCents: SHB_FIXTURE.jobTotalCents,
      cbCents: SHB_FIXTURE.jobTotalCents,
      ceCents: SHB_FIXTURE.jobTotalCents,
    });
  });

  it("says when the job does not exist", async () => {
    const companyId = await sandbox();
    const r = await importEstimateCsv(companyId, "99-999", SHB_CSV);
    expect(r).toMatchObject({ ok: false, reason: "not_found" });
    expect(r.summary).toBe("There is no job 99-999 in this sandbox.");
  });
});
