import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies, costItems } from "@/db/schema";
import {
  averagePerformanceEacCents,
  itemForecast,
} from "@/lib/ev";
import { seedId } from "@/seed";
import { getCostItemPage } from "@/server/cost-item-page";
import { pathRollupSql } from "@/server/cost-rollups";
import { createSandbox } from "@/server/sandbox";

/**
 * Independent half-up reference (test-local). Must not import the production
 * helper for expected values — hard-coded literals and this twin catch drift.
 */
function refHalfUpEac(ac: number, bac: number, ev: number): number {
  const a = BigInt(ac);
  const b = BigInt(bac);
  const e = BigInt(ev);
  return Number((BigInt(2) * a * b + e) / (BigInt(2) * e));
}

/** Wrong path A: round % complete to 0.1%, then AC ÷ pct. */
function viaRoundedPercent01(ac: number, bac: number, ev: number): number {
  const pct = ev / bac;
  const pctRounded = Math.round(pct * 1000) / 1000;
  return Math.round(ac / pctRounded);
}

/** Wrong path B: round BAC/EV to 4 decimal places, then AC × ratio. */
function viaRatio4dp(ac: number, bac: number, ev: number): number {
  const ratio = Math.round((bac / ev) * 10_000) / 10_000;
  return Math.round(ac * ratio);
}

/** Wrong path C: IEEE float product (fails when AC×BAC > 2^53). */
function viaFloatProduct(ac: number, bac: number, ev: number): number {
  return Math.round((ac * bac) / ev);
}

describe("Average Performance exact integer EAC", () => {
  /**
   * Verify FAIL repro (PR #726): BAC 180464467¢, EV 104308462¢ (≈57.8%),
   * AC 52154231¢. Exact quotient 90232233.5 → EAC 90232234¢.
   * Float Math.round((ac*bac)/ev) yields 90232233.
   */
  const REPRO = {
    ac: 52_154_231,
    bac: 180_464_467,
    ev: 104_308_462,
    /** Hand-checked: (2·AC·BAC + EV) / (2·EV) with BigInt = 90232234 */
    expectedEac: 90_232_234,
  } as const;

  it("repro: exact half above 2^53 rounds half-up to 90232234¢", () => {
    expect(REPRO.ac * REPRO.bac).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(refHalfUpEac(REPRO.ac, REPRO.bac, REPRO.ev)).toBe(
      REPRO.expectedEac,
    );
    expect(
      averagePerformanceEacCents(REPRO.ac, REPRO.bac, REPRO.ev),
    ).toBe(REPRO.expectedEac);
    expect(
      itemForecast({
        forecastMethod: "average_performance",
        budgetCents: REPRO.bac,
        earnedCents: REPRO.ev,
        actualCents: REPRO.ac,
      }).eacCents,
    ).toBe(REPRO.expectedEac);
    // Float product path is the bug — must disagree on this fixture.
    expect(viaFloatProduct(REPRO.ac, REPRO.bac, REPRO.ev)).toBe(90_232_233);
    expect(viaFloatProduct(REPRO.ac, REPRO.bac, REPRO.ev)).not.toBe(
      REPRO.expectedEac,
    );
  });

  /**
   * Fixture with non-terminating % complete where both per-step rounding
   * shortcuts disagree with exact half-up. Expected is a hard-coded literal
   * from independent BigInt math (not the function under test).
   *
   * AC 2_338_982_702 · BAC 1_000_215_059 · EV 668_280_772
   * → exact EAC 3_500_752_707¢
   * → via 0.1% percent: 3_501_471_111¢
   * → via BAC/EV 4dp:   3_500_755_410¢
   */
  const STEP = {
    ac: 2_338_982_702,
    bac: 1_000_215_059,
    ev: 668_280_772,
    expectedEac: 3_500_752_707,
  } as const;

  it("must-fail: does not round percent to 0.1% before dividing", () => {
    expect(refHalfUpEac(STEP.ac, STEP.bac, STEP.ev)).toBe(STEP.expectedEac);
    const roundedPct = viaRoundedPercent01(STEP.ac, STEP.bac, STEP.ev);
    expect(roundedPct).toBe(3_501_471_111);
    expect(roundedPct).not.toBe(STEP.expectedEac);

    const got = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: STEP.bac,
      earnedCents: STEP.ev,
      actualCents: STEP.ac,
    }).eacCents;
    expect(got).toBe(STEP.expectedEac);
    // Goes red if itemForecast is scratch-reverted to the 0.1% path.
    expect(got).not.toBe(roundedPct);
  });

  it("must-fail: does not round BAC/EV to 4 decimal places first", () => {
    expect(refHalfUpEac(STEP.ac, STEP.bac, STEP.ev)).toBe(STEP.expectedEac);
    const ratio4 = viaRatio4dp(STEP.ac, STEP.bac, STEP.ev);
    expect(ratio4).toBe(3_500_755_410);
    expect(ratio4).not.toBe(STEP.expectedEac);

    const got = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: STEP.bac,
      earnedCents: STEP.ev,
      actualCents: STEP.ac,
    }).eacCents;
    expect(got).toBe(STEP.expectedEac);
    // Goes red if itemForecast is scratch-reverted to the 4dp ratio path.
    expect(got).not.toBe(ratio4);
  });

  it("property/fuzz: half-cent and large-product cases match independent BigInt", () => {
    let s = 0xdeadbeef >>> 0;
    const next = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s;
    };
    const modInv = (a: bigint, m: bigint): bigint | null => {
      let t = BigInt(0);
      let newT = BigInt(1);
      let r = m;
      let newR = ((a % m) + m) % m;
      while (newR !== BigInt(0)) {
        const q = r / newR;
        [t, newT] = [newT, t - q * newT];
        [r, newR] = [newR, r - q * newR];
      }
      if (r > BigInt(1)) return null;
      if (t < BigInt(0)) t += m;
      return t;
    };

    let halfCases = 0;
    let largeProduct = 0;
    for (let i = 0; i < 20_000 && halfCases < 40; i++) {
      // Odd BAC + even EV so gcd can be 1 (LCG pairs otherwise keep BAC even).
      const bac = 50_000_001 + 2 * (next() % 3_975_000_000);
      const ev = 2 + 2 * (next() % Math.max(1, Math.floor((bac - 2) / 2)));
      if (ev <= 0 || ev >= bac) continue;
      const inv = modInv(BigInt(bac) % BigInt(ev), BigInt(ev));
      if (inv == null) continue;
      const target = BigInt(ev / 2);
      const base = (target * inv) % BigInt(ev);
      const acBig = base + BigInt(1 + (next() % 4)) * BigInt(ev);
      if (acBig <= BigInt(0)) continue;
      if ((acBig * BigInt(bac)) % BigInt(ev) !== target) continue;
      // Keep AC in Number range for the API (cents fit in signed 53+ bits easily here).
      if (acBig > BigInt(Number.MAX_SAFE_INTEGER)) continue;
      const ac = Number(acBig);

      const expected = refHalfUpEac(ac, bac, ev);
      expect(averagePerformanceEacCents(ac, bac, ev)).toBe(expected);
      expect(
        itemForecast({
          forecastMethod: "average_performance",
          budgetCents: bac,
          earnedCents: ev,
          actualCents: ac,
        }).eacCents,
      ).toBe(expected);

      halfCases++;
      if (acBig * BigInt(bac) > BigInt(Number.MAX_SAFE_INTEGER)) {
        largeProduct++;
      }
    }
    expect(halfCases).toBeGreaterThan(20);
    expect(largeProduct).toBeGreaterThan(20);
  });
});

describe.skipIf(!getDb())("JS itemForecast EAC matches SQL eacSql", () => {
  const created: string[] = [];
  afterAll(async () => {
    const db = getDb();
    if (!db) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it(
    "leaf with AC×BAC > 2^53: getCostItemPage EAC === pathRollupSql EAC === 90232234",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const db = requireDb();
      const itemId = seedId(companyId, "cost:cedar:02-100");

      // Force the Verify repro numbers onto 02-100 (pm_percent / LS).
      await db
        .update(costItems)
        .set({
          forecastMethod: "average_performance",
          cbLaborCents: 180_464_467,
          cbMaterialCents: 0,
          cbEquipmentCents: 0,
          cbSubCents: 0,
          lockedActualCents: 52_154_231,
          actualCents: 52_154_231,
          claimedPercentMilli: 578,
          claimedInstalledQtyMilli: 0,
          budgetQtyMilli: 1000,
          evMethod: "pm_percent",
        })
        .where(eq(costItems.id, itemId));

      const [row] = await db
        .select({
          path: costItems.path,
          jobId: costItems.jobId,
        })
        .from(costItems)
        .where(eq(costItems.id, itemId))
        .limit(1);
      expect(row).toBeTruthy();

      const page = await getCostItemPage(companyId, "25-031", "02-100");
      expect(page).not.toBeNull();
      // EV from claimed percent: round(BAC × 578 / 1000).
      expect(page!.rollup.earnedCents).toBe(
        Math.round((180_464_467 * 578) / 1000),
      );
      expect(page!.rollup.earnedCents).toBe(104_308_462);
      expect(page!.forecast.eacCents).toBe(90_232_234);

      const sql = await pathRollupSql(companyId, row!.jobId, row!.path);
      expect(sql.eacCents).toBe(90_232_234);
      expect(sql.eacCents).toBe(page!.forecast.eacCents);
      expect(sql.eacCents).toBe(
        averagePerformanceEacCents(
          page!.rollup.actualCents,
          page!.rollup.budgetCents,
          page!.rollup.earnedCents,
        ),
      );
    },
    120_000,
  );
});
