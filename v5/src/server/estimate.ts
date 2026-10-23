import "server-only";
import { and, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { costItems, jobs } from "@/db/schema";
import {
  approveTotalsGuard,
  currentEstimateCents,
  originalBudgetCents,
} from "@/lib/budget";
import { usdShort } from "@/lib/ev";

export type ApproveEstimateResult =
  | {
      ok: true;
      jobNumber: string;
      shortName: string;
      originalBudgetCents: number;
      leafCount: number;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "already_approved"
        | "mismatch"
        | "no_leaves";
      summary: string;
      estimateTotalCents?: number;
      budgetTotalCents?: number;
    };

/**
 * Approve the estimate: freeze Original Budget from Current Estimate, set
 * Current Budget = Original, mark the job approved. All-or-nothing transaction.
 * Only writer of OB columns. Refuses when CE total ≠ the OB that would be written.
 *
 * Optional `proposedObTotalCents` is a test hook (acceptance check 8): when set and
 * it differs from the CE total, Approve refuses without writing.
 */
export async function approveEstimate(
  companyId: string,
  jobNumber: string,
  opts?: { proposedObTotalCents?: number },
): Promise<ApproveEstimateResult> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
      .limit(1)
      .for("update");
    if (!job) {
      return {
        ok: false,
        reason: "not_found",
        summary: `There is no job ${jobNumber} in this sandbox.`,
      };
    }
    if (job.estimateStatus === "approved") {
      return {
        ok: false,
        reason: "already_approved",
        summary: `${job.shortName}'s estimate is already approved. Original Budget is frozen — use a change order to revise Current Budget.`,
      };
    }

    const leaves = await tx
      .select()
      .from(costItems)
      .where(
        and(
          eq(costItems.companyId, companyId),
          eq(costItems.jobId, job.id),
          eq(costItems.isLeaf, true),
        ),
      );

    if (leaves.length === 0) {
      return {
        ok: false,
        reason: "no_leaves",
        summary: `${job.shortName} has no leaf cost items to approve.`,
      };
    }

    const estimateTotal = leaves.reduce(
      (s, l) => s + currentEstimateCents(l),
      0,
    );
    // Normal path: OB written = CE (must match). Test hook can force a mismatch.
    const budgetTotal =
      opts?.proposedObTotalCents !== undefined
        ? opts.proposedObTotalCents
        : estimateTotal;
    const guard = approveTotalsGuard(estimateTotal, budgetTotal);
    if (!guard.ok) {
      return {
        ok: false,
        reason: "mismatch",
        summary:
          `Approve refused: estimate total ${usdShort(guard.estimateTotalCents)} ` +
          `(${guard.estimateTotalCents}¢) does not match budget total ` +
          `${usdShort(guard.budgetTotalCents)} (${guard.budgetTotalCents}¢).`,
        estimateTotalCents: guard.estimateTotalCents,
        budgetTotalCents: guard.budgetTotalCents,
      };
    }

    for (const leaf of leaves) {
      await tx
        .update(costItems)
        .set({
          obLaborCents: leaf.ceLaborCents,
          obMaterialCents: leaf.ceMaterialCents,
          obEquipmentCents: leaf.ceEquipmentCents,
          obSubCents: leaf.ceSubCents,
          cbLaborCents: leaf.ceLaborCents,
          cbMaterialCents: leaf.ceMaterialCents,
          cbEquipmentCents: leaf.ceEquipmentCents,
          cbSubCents: leaf.ceSubCents,
        })
        .where(eq(costItems.id, leaf.id));
    }

    // Post-write reconciliation: CE and OB must still match (all-or-nothing).
    const after = await tx
      .select()
      .from(costItems)
      .where(
        and(
          eq(costItems.companyId, companyId),
          eq(costItems.jobId, job.id),
          eq(costItems.isLeaf, true),
        ),
      );
    const obTotal = after.reduce((s, l) => s + originalBudgetCents(l), 0);
    const ceTotal = after.reduce((s, l) => s + currentEstimateCents(l), 0);
    const check = approveTotalsGuard(ceTotal, obTotal);
    if (!check.ok) {
      throw new Error(
        `approveEstimate mismatch after write: CE ${check.estimateTotalCents} ≠ OB ${check.budgetTotalCents}`,
      );
    }

    await tx
      .update(jobs)
      .set({ estimateStatus: "approved" })
      .where(eq(jobs.id, job.id));

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      originalBudgetCents: obTotal,
      leafCount: leaves.length,
    };
  });
}
