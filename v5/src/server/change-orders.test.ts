import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  changeOrderEvents,
  changeOrders,
  companies,
  costItems,
  jobs,
} from "@/db/schema";
import { categoryTotal } from "@/lib/budget";
import type { CoActor } from "@/lib/change-order";
import { seedId } from "@/seed";
import { changeOrderCommand } from "./change-orders";
import { createSandbox } from "./sandbox";

const db = getDb();
const created: string[] = [];
const DELTA = 6_000_000;

function actor(companyId: string, role: CoActor["role"]): CoActor {
  return { userId: seedId(companyId, `user:${role}`), role };
}

async function leafMoney(companyId: string, jobNumber: string) {
  const rows = await db!
    .select({
      code: costItems.code,
      obLaborCents: costItems.obLaborCents,
      obMaterialCents: costItems.obMaterialCents,
      obEquipmentCents: costItems.obEquipmentCents,
      obSubCents: costItems.obSubCents,
      cbLaborCents: costItems.cbLaborCents,
      cbMaterialCents: costItems.cbMaterialCents,
      cbEquipmentCents: costItems.cbEquipmentCents,
      cbSubCents: costItems.cbSubCents,
    })
    .from(costItems)
    .innerJoin(jobs, eq(jobs.id, costItems.jobId))
    .where(
      and(
        eq(jobs.companyId, companyId),
        eq(jobs.number, jobNumber),
        eq(costItems.isLeaf, true),
      ),
    )
    .orderBy(asc(costItems.code));
  const ob = rows.reduce(
    (s, r) =>
      s +
      categoryTotal({
        laborCents: r.obLaborCents,
        materialCents: r.obMaterialCents,
        equipmentCents: r.obEquipmentCents,
        subCents: r.obSubCents,
      }),
    0,
  );
  const cb = rows.reduce(
    (s, r) =>
      s +
      categoryTotal({
        laborCents: r.cbLaborCents,
        materialCents: r.cbMaterialCents,
        equipmentCents: r.cbEquipmentCents,
        subCents: r.cbSubCents,
      }),
    0,
  );
  return { rows, ob, cb };
}

describe.skipIf(!db)("change orders", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("approving CO-001 moves Current Budget once and leaves Original Budget", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const before = await leafMoney(companyId, "25-031");
    const executive = actor(companyId, "executive");
    const approve = {
      kind: "approve" as const,
      co: { number: 1 },
    };
    const [a, b] = await Promise.all([
      changeOrderCommand(companyId, executive, "25-031", approve),
      changeOrderCommand(companyId, executive, "25-031", approve),
    ]);
    const results = [a, b];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const refused = results.find((r) => !r.ok);
    expect(refused && !refused.ok && refused.refusal.kind).toBe("already");
    const moved = results.find((r) => r.ok);
    expect(moved && moved.ok && moved.command === "approve" && moved.move).toMatchObject({
      cbDeltaCents: DELTA,
      eacDeltaCents: DELTA,
    });

    const after = await leafMoney(companyId, "25-031");
    expect(after.ob).toBe(before.ob);
    expect(after.cb).toBe(before.cb + DELTA);
    const wall = after.rows.find((r) => r.code === "91-100");
    expect(wall).toMatchObject({
      obLaborCents: 0,
      obMaterialCents: 0,
      obEquipmentCents: 0,
      obSubCents: 0,
      cbLaborCents: 1_850_000,
      cbMaterialCents: 2_325_000,
      cbEquipmentCents: 610_000,
      cbSubCents: 1_215_000,
    });
    for (const row of before.rows) {
      const same = after.rows.find((r) => r.code === row.code);
      expect(same).toMatchObject({
        obLaborCents: row.obLaborCents,
        obMaterialCents: row.obMaterialCents,
        obEquipmentCents: row.obEquipmentCents,
        obSubCents: row.obSubCents,
        cbLaborCents: row.cbLaborCents,
        cbMaterialCents: row.cbMaterialCents,
        cbEquipmentCents: row.cbEquipmentCents,
        cbSubCents: row.cbSubCents,
      });
    }

    const events = await db!
      .select({ command: changeOrderEvents.command, to: changeOrderEvents.toStatus })
      .from(changeOrderEvents)
      .innerJoin(changeOrders, eq(changeOrders.id, changeOrderEvents.changeOrderId))
      .innerJoin(jobs, eq(jobs.id, changeOrders.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031"), eq(changeOrders.number, 1)));
    expect(events.filter((e) => e.to === "approved")).toHaveLength(1);
  });

  it("reject and void move nothing, and a draft estimate cannot take a change order", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = actor(companyId, "pm");
    const executive = actor(companyId, "executive");
    const before = await leafMoney(companyId, "24-118");

    const raised = await changeOrderCommand(companyId, pm, "24-118", {
      kind: "create",
      title: "Temporary sheet pile",
      reason: "County moved the abutment",
    });
    expect(raised.ok).toBe(true);
    const voided = await changeOrderCommand(companyId, pm, "24-118", {
      kind: "void",
      co: { number: 1 },
      reason: "Duplicate of the field note",
    });
    expect(voided.ok && voided.to).toBe("voided");

    const priced = await changeOrderCommand(companyId, pm, "24-118", {
      kind: "create",
      title: "Extra railing",
      reason: "",
    });
    expect(priced.ok).toBe(true);
    const lines = await changeOrderCommand(companyId, pm, "24-118", {
      kind: "price",
      co: { number: 2 },
      lines: [
        {
          code: "91-200",
          description: "Extra railing",
          unit: "LS",
          labor: "1,000",
        },
      ],
    });
    expect(lines.ok).toBe(true);
    const rejected = await changeOrderCommand(companyId, executive, "24-118", {
      kind: "reject",
      co: { number: 2 },
      reason: "Owner declined",
    });
    expect(rejected.ok && rejected.to).toBe("rejected");

    const after = await leafMoney(companyId, "24-118");
    expect(after.rows).toEqual(before.rows);

    const harbor = await changeOrderCommand(companyId, pm, "26-010", {
      kind: "create",
      title: "Should not exist",
      reason: "",
    });
    expect(harbor.ok).toBe(false);
    if (!harbor.ok) expect(harbor.refusal.kind).toBe("estimate_not_approved");
    const [harborCos] = await db!
      .select({
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(changeOrders)
      .innerJoin(jobs, eq(jobs.id, changeOrders.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "26-010")));
    expect(harborCos.n).toBe(0);
  });
});
