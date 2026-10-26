import "server-only";
import type { Db } from "@/db";
import { dailyPlanEvents, type planEventKindEnum } from "@/db/schema";
import type { Role } from "@/server/session";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type PlanEventKind = (typeof planEventKindEnum.enumValues)[number];

export type PlanActor = {
  userId: string | null;
  role: Role;
};

/** Insert one append-only plan lifecycle event (same transaction as the stamp write). */
export async function recordPlanEvent(
  tx: Tx,
  args: {
    companyId: string;
    planId: string;
    kind: PlanEventKind;
    actor: PlanActor;
    detail?: string;
    at: Date;
  },
) {
  await tx.insert(dailyPlanEvents).values({
    companyId: args.companyId,
    planId: args.planId,
    kind: args.kind,
    actorRole: args.actor.role,
    actorId: args.actor.userId,
    detail: args.detail ?? "",
    at: args.at,
  });
}
