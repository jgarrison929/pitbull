import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, costEntries, costItems, jobs } from "@/db/schema";
import {
  CREW_LABOR_RATE_CENTS,
  CREW_RATE_EXPAND_DEFAULT_CENTS,
} from "@/lib/crew-rates";
import { usdCents } from "@/lib/ev";
import { jobRollupSql } from "@/server/cost-rollups";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";

/**
 * Generates the Part A "Money numbers that moved" table from live rollups
 * (same path as job-eac data-cents). Run:
 *   V5_SEED_NOW=2026-10-20T17:00:00.000Z npx vitest run src/server/part-a-money-delta.test.ts
 *
 * Before column = after − ΔAC, ΔAC = laborMH × (crewRate − 8500).
 * Cost variance = EV − AC (moves by −ΔAC when AC moves).
 */
const db = getDb();
const created: string[] = [];

const RATE_BY_NUMBER: Record<string, number> = {
  "25-031": CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
  "24-077": CREW_LABOR_RATE_CENTS["Culvert Crew A"],
  "24-118": CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
};

/** Verify FAIL comment @ 9334b7ab — UI data-cents + hand. */
const VERIFY_AFTER_EAC_CENTS = {
  "24-077": 895_466_400,
  "24-118": 4_429_215_502,
  "25-031": 1_472_078_625,
} as const;

describe.skipIf(!db)("Part A money delta (rollups)", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("prints markdown table and matches Verify EAC cents", async () => {
    process.env.V5_SEED_NOW ??= "2026-10-20T17:00:00.000Z";
    const companyId = await createSandbox(seedNow());
    created.push(companyId);
    const asOf = seedNow();

    const jobRows = await db!
      .select({ id: jobs.id, number: jobs.number, shortName: jobs.shortName })
      .from(jobs)
      .where(eq(jobs.companyId, companyId));

    const active = jobRows
      .filter((j) => j.number !== "26-010")
      .sort((a, b) => a.number.localeCompare(b.number));

    type Line = {
      number: string;
      short: string;
      acB: number;
      acA: number;
      eacB: number;
      eacA: number;
      cvB: number;
      cvA: number;
    };
    const lines: Line[] = [];
    let portAcB = 0;
    let portAcA = 0;
    let portEacB = 0;
    let portEacA = 0;

    for (const j of active) {
      const roll = await jobRollupSql(companyId, j.id, asOf);
      const leaves = await db!
        .select({ id: costItems.id })
        .from(costItems)
        .where(eq(costItems.jobId, j.id));
      const leafIds = new Set(leaves.map((l) => l.id));
      const entries = await db!
        .select()
        .from(costEntries)
        .where(eq(costEntries.companyId, companyId));
      let laborAfter = 0;
      for (const e of entries) {
        if (e.kind !== "labor" || !leafIds.has(e.costItemId)) continue;
        laborAfter += e.amountCents;
      }
      const rate = RATE_BY_NUMBER[j.number] ?? CREW_RATE_EXPAND_DEFAULT_CENTS;
      const laborMh = laborAfter / rate;
      const deltaAc = Math.round(
        laborMh * (rate - CREW_RATE_EXPAND_DEFAULT_CENTS),
      );
      const acAfter = roll.actualCents;
      const eacAfter = roll.eacCents;
      const ev = roll.earnedCents;
      const acBefore = acAfter - deltaAc;
      const eacBefore = eacAfter - deltaAc;
      const cvAfter = ev - acAfter;
      const cvBefore = ev - acBefore;

      expect(
        eacAfter,
        `${j.number} EAC after vs Verify UI`,
      ).toBe(VERIFY_AFTER_EAC_CENTS[j.number as keyof typeof VERIFY_AFTER_EAC_CENTS]);

      lines.push({
        number: j.number,
        short: j.shortName,
        acB: acBefore,
        acA: acAfter,
        eacB: eacBefore,
        eacA: eacAfter,
        cvB: cvBefore,
        cvA: cvAfter,
      });
      portAcB += acBefore;
      portAcA += acAfter;
      portEacB += eacBefore;
      portEacA += eacAfter;
    }

    const mdRow = (label: string, before: number, after: number) => {
      const d = after - before;
      const sign = d < 0 ? "−" : "+";
      return `| **${label}** | ${usdCents(before)} | ${usdCents(after)} | ${sign}${usdCents(Math.abs(d))} |`;
    };

    const out: string[] = [
      "| Surface | Before (flat $85.00/MH) | After (crew rates) | Δ |",
      "|---|---|---|---|",
    ];
    for (const l of lines) {
      out.push(mdRow(`${l.number} ${l.short} AC`, l.acB, l.acA));
      out.push(mdRow(`${l.number} ${l.short} EAC (M4)`, l.eacB, l.eacA));
      out.push(
        mdRow(`${l.number} ${l.short} cost variance (EV−AC)`, l.cvB, l.cvA),
      );
    }
    out.push(mdRow("Portfolio active AC", portAcB, portAcA));
    out.push(mdRow("Portfolio active EAC", portEacB, portEacA));
    out.push(
      "| **26-010** Harbor change history | — (draft; no AC/EAC/labor) | — (unchanged) | pixel-only baseline refresh; no money figure changed |",
    );

    // eslint-disable-next-line no-console
    console.log("\n" + out.join("\n") + "\n");

    expect(portEacA).toBe(
      VERIFY_AFTER_EAC_CENTS["24-077"] +
        VERIFY_AFTER_EAC_CENTS["24-118"] +
        VERIFY_AFTER_EAC_CENTS["25-031"],
    );
    expect(usdCents(portEacB)).toBe("$67,941,780.72");
    expect(usdCents(portEacA)).toBe("$67,967,605.27");
  });
});
