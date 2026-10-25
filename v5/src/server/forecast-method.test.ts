import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies, costItems } from "@/db/schema";
import {
  itemForecast,
  type ForecastMethod,
} from "@/lib/ev";
import { actionRailLabel } from "@/lib/assistant/labels";
import { parseForecastMethodCue, route } from "@/lib/assistant/route";
import { seedId } from "@/seed";
import { run } from "@/server/assistant/actions";
import { getCostItemPage } from "@/server/cost-item-page";
import { jobRollupSql } from "@/server/cost-rollups";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const jobs = [
  { number: "25-031", name: "Cedar Creek Bridge", shortName: "Cedar Creek" },
  { number: "24-118", name: "SR-99 Interchange", shortName: "SR-99" },
];

function asUser(
  companyId: string,
  role: CurrentUser["role"],
  key: "pm" | "executive",
): CurrentUser {
  const names = {
    pm: { name: "Marcus Lee", title: "Project Manager" },
    executive: { name: "Elena Brooks", title: "VP Operations" },
  } as const;
  return {
    companyId,
    userId: seedId(companyId, `user:${key}`),
    role,
    name: names[key].name,
    title: names[key].title,
    companyName: "Demo",
    seededAt: new Date("2026-10-20T17:00:00.000Z"),
    expiresAt: null,
  };
}

describe("Part B: Average Performance forecast (checks 7–9)", () => {
  it("check 7 formula: EAC = locked AC ÷ locked percent, rounded once", () => {
    // AC $538,728 · BAC $868,000 · EV $347,200 (40%) → EAC $1,346,820
    const f = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: 86_800_000,
      earnedCents: 34_720_000,
      actualCents: 53_872_800,
    });
    expect(f.eacCents).toBe(134_682_000);
    expect(f.forecastFallback).toBe(false);
    expect(f.forecastDerivation).toMatch(/average performance/);
  });

  it("check 8 formula: 0% claimed falls back; EAC unchanged and labeled", () => {
    const current = itemForecast({
      forecastMethod: "current_budget",
      budgetCents: 238_000_000,
      earnedCents: 0,
      actualCents: 0,
    });
    const avg = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: 238_000_000,
      earnedCents: 0,
      actualCents: 0,
    });
    expect(avg.eacCents).toBe(current.eacCents);
    expect(avg.forecastFallback).toBe(true);
    expect(avg.forecastDerivation).toMatch(/fell back/);
  });

  it("check 9 refusal label is exact", () => {
    expect(
      actionRailLabel("costItem.setForecastMethod", "25-031", {
        refused: true,
      }),
    ).toBe("Couldn't set forecast method on 25-031");
  });

  it("must-fail: average_performance EAC is not current_budget arithmetic", () => {
    const ac = 53_872_800;
    const bac = 86_800_000;
    const ev = 34_720_000;
    const avg = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: bac,
      earnedCents: ev,
      actualCents: ac,
    });
    const wrong = ac + (bac - ev);
    expect(avg.eacCents).not.toBe(wrong);
    // Exact half-up of AC×BAC÷EV for this (safe) fixture: 134_682_000.
    expect(avg.eacCents).toBe(134_682_000);
  });

  it("must-fail: fallback must be labeled when EV is 0", () => {
    const f = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: 90_000_000,
      earnedCents: 0,
      actualCents: 0,
    });
    expect(f.forecastFallback).toBe(true);
    expect(f.forecastDerivation).toMatch(/fell back|fallback/i);
  });

  it("route: Set 04-210 on 25-031 to average performance (never guesses)", () => {
    expect(
      route("Set 04-210 on 25-031 to average performance", jobs),
    ).toEqual({
      action: "costItem.setForecastMethod",
      args: {
        job: "25-031",
        costCode: "04-210",
        lineRef: "Set 04-210 on 25-031 to average performance",
        forecastMethod: "average_performance",
      },
    });
    // No named method → do not invent one.
    expect(parseForecastMethodCue("Set forecast method on 04-210")).toBeNull();
    expect(route("Set forecast method on 04-210", jobs)?.action).not.toBe(
      "costItem.setForecastMethod",
    );
  });
});

describe.skipIf(!getDb())("Part B sandbox: switch moves job EAC exactly", () => {
  const created: string[] = [];

  afterAll(async () => {
    const db = getDb();
    if (!db) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it(
    "check 7: PM switch on 04-210 moves job EAC by the item delta; changes list names actor",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const db = requireDb();
      const pm = asUser(companyId, "pm", "pm");

      const beforeItem = await getCostItemPage(companyId, "25-031", "04-210");
      expect(beforeItem).not.toBeNull();
      expect(beforeItem!.item.forecastMethod).toBe("current_budget");
      const [job] = await db
        .select({ id: costItems.jobId })
        .from(costItems)
        .where(eq(costItems.id, beforeItem!.item.id))
        .limit(1);
      const beforeJob = await jobRollupSql(companyId, job!.id);
      const oldItemEac = beforeItem!.forecast.eacCents;

      const { result } = await run(
        pm,
        "Set 04-210 on 25-031 to average performance",
        "costItem.setForecastMethod",
        {
          job: "25-031",
          costCode: "04-210",
          forecastMethod: "average_performance",
        },
      );
      expect(result.refused).toBeUndefined();
      expect(result.summary).toMatch(/Average Performance/);

      const afterItem = await getCostItemPage(companyId, "25-031", "04-210");
      expect(afterItem!.item.forecastMethod).toBe(
        "average_performance" satisfies ForecastMethod,
      );
      const lockedAc = afterItem!.rollup.actualCents;
      const lockedEv = afterItem!.rollup.earnedCents;
      const bac = afterItem!.rollup.budgetCents;
      expect(lockedEv).toBeGreaterThan(0);
      const expectedEac = Math.round((lockedAc * bac) / lockedEv);
      expect(afterItem!.forecast.eacCents).toBe(expectedEac);
      expect(afterItem!.forecast.eacCents).toBe(
        itemForecast({
          forecastMethod: "average_performance",
          budgetCents: bac,
          earnedCents: lockedEv,
          actualCents: lockedAc,
        }).eacCents,
      );

      const afterJob = await jobRollupSql(companyId, job!.id);
      expect(afterJob.eacCents - beforeJob.eacCents).toBe(
        afterItem!.forecast.eacCents - oldItemEac,
      );

      // Changes on this job — actor is the PM (Marcus Lee in demo seed).
      const { jobChanges } = await import("@/server/assistant/actions");
      const changes = await jobChanges(companyId, "25-031", 5);
      const hit = changes.find((c) =>
        c.summary.includes("Average Performance"),
      );
      expect(hit).toBeTruthy();
      expect(hit!.userName).toMatch(/Marcus Lee|pm/i);
    },
    120_000,
  );

  it(
    "check 8: 05-120 at 0% claimed — EAC unchanged and labeled fallback",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const pm = asUser(companyId, "pm", "pm");

      const before = await getCostItemPage(companyId, "25-031", "05-120");
      expect(before).not.toBeNull();
      expect(before!.rollup.earnedCents).toBe(0);
      const eacBefore = before!.forecast.eacCents;

      await run(
        pm,
        "Set 05-120 on 25-031 to average performance",
        "costItem.setForecastMethod",
        {
          job: "25-031",
          costCode: "05-120",
          forecastMethod: "average_performance",
        },
      );

      const after = await getCostItemPage(companyId, "25-031", "05-120");
      expect(after!.forecast.eacCents).toBe(eacBefore);
      expect(after!.forecast.forecastFallback).toBe(true);
      expect(after!.forecast.forecastDerivation).toMatch(/fell back/);
    },
    120_000,
  );

  it(
    "check 9: executive rail request is refused with exact chip text",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const executive = asUser(companyId, "executive", "executive");

      const ran = await run(
        executive,
        "Set 04-210 on 25-031 to average performance",
        "costItem.setForecastMethod",
        {
          job: "25-031",
          costCode: "04-210",
          forecastMethod: "average_performance",
        },
      );
      expect(ran.result.refused).toBe(true);
      expect(
        actionRailLabel(
          ran.action,
          (ran.args as { job?: string }).job,
          { refused: true },
        ),
      ).toBe("Couldn't set forecast method on 25-031");

      // Must-fail: method must not have changed.
      const item = await getCostItemPage(companyId, "25-031", "04-210");
      expect(item!.item.forecastMethod).toBe("current_budget");
    },
    120_000,
  );
});
