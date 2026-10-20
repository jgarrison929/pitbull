"use server";

import { revalidatePath } from "next/cache";
import { examples, route, type JobArgs } from "@/lib/assistant/route";
import { isActionName, run } from "@/server/assistant/actions";
import { getPortfolio } from "@/server/data";
import { requireUser } from "@/server/session";

export type AskState = { help?: string; error?: string };

/** The assistant: route the request to a typed action, run it, and refresh every screen that shows its data. */
export async function ask(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const prompt = String(formData.get("prompt") ?? "")
    .trim()
    .slice(0, 500);
  if (!prompt) return {};
  const user = await requireUser();
  const { jobs } = await getPortfolio(user.companyId);
  const intent = route(
    prompt,
    jobs.map((j) => j.job),
  );
  if (!intent)
    return {
      help: `I can't do that yet. Try: ${examples.map((e) => `"${e}"`).join(", ")}.`,
    };
  await run(user, prompt, intent.action, intent.args);
  revalidatePath("/app", "layout");
  return {};
}

export type ActionState = { summary?: string };

function argsFromForm(formData: FormData): JobArgs {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v ? v : undefined;
  };
  const completeRaw = str("complete");
  // Report form: actualMh[<lineId>] / actualQty[<lineId>]
  // Empty or non-finite values are kept (as NaN) so the action can reject them —
  // never drop the key and silently fall back to the plan.
  const actuals: NonNullable<JobArgs["actuals"]> = [];
  const mhByLine = new Map<string, number>();
  const qtyByLine = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const mh = key.match(/^actualMh\[([^\]]+)\]$/);
    if (mh) {
      const raw = value.trim().replace(/,/g, "");
      mhByLine.set(mh[1], raw === "" ? Number.NaN : Number(raw));
      continue;
    }
    const q = key.match(/^actualQty\[([^\]]+)\]$/);
    if (q) {
      const raw = value.trim().replace(/,/g, "");
      qtyByLine.set(q[1], raw === "" ? Number.NaN : Number(raw));
    }
  }
  const lineIds = new Set([...mhByLine.keys(), ...qtyByLine.keys()]);
  for (const lineId of lineIds) {
    actuals.push({
      lineId,
      manHours: mhByLine.get(lineId),
      qty: qtyByLine.get(lineId),
    });
  }
  return {
    job: str("job"),
    lineId: str("lineId"),
    costItemId: str("costItemId"),
    costCode: str("costCode"),
    percent: str("percent"),
    reason: str("reason"),
    milestoneId: str("milestoneId"),
    complete:
      completeRaw === undefined
        ? undefined
        : completeRaw === "true" || completeRaw === "1",
    ...(actuals.length ? { actuals } : {}),
  };
}

async function executeFormAction(formData: FormData): Promise<ActionState> {
  const action = formData.get("action");
  const label = String(formData.get("label") ?? action);
  if (!isActionName(action)) return {};
  const user = await requireUser();
  const { result } = await run(
    user,
    `${label} (button)`,
    action,
    argsFromForm(formData),
  );
  revalidatePath("/app", "layout");
  return { summary: result.summary };
}

/** Plain form action for lock / submit / report buttons. */
export async function runAction(formData: FormData): Promise<void> {
  await executeFormAction(formData);
}

/** useActionState wrapper for PM percent / milestone forms that show a summary. */
export async function runActionState(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return executeFormAction(formData);
}

export type SaveLineState = {
  errors?: Record<string, string>;
  savedAt?: number;
};

const LINE_FIELDS = [
  "costItemId",
  "activity",
  "location",
  "qty",
  "workers",
  "hours",
  "manHours",
  "notes",
] as const;

/** The plan line form. It posts to the same dailyPlan.updateLine action the assistant uses. */
export async function saveLine(
  _prev: SaveLineState,
  formData: FormData,
): Promise<SaveLineState> {
  const user = await requireUser();
  const lineId = String(formData.get("lineId") ?? "");
  const change: Record<string, string> = {};
  for (const f of LINE_FIELDS) {
    const v = formData.get(f);
    if (typeof v === "string") change[f] = v;
  }
  const label = String(formData.get("label") ?? "plan line").slice(0, 120);
  const { result } = await run(
    user,
    `Edit ${label} (screen)`,
    "dailyPlan.updateLine",
    { lineId, change },
  );
  revalidatePath("/app", "layout");
  if (result.errors) return { errors: result.errors };
  return { savedAt: Date.now() };
}
