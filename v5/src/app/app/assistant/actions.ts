"use server";

import { revalidatePath } from "next/cache";
import { examples, route } from "@/lib/assistant/route";
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

/** On-screen buttons call the same typed actions as the assistant, so they share checks and the log. */
export async function runAction(formData: FormData) {
  const action = formData.get("action");
  const job = formData.get("job");
  const label = String(formData.get("label") ?? action);
  if (!isActionName(action)) return;
  const user = await requireUser();
  await run(
    user,
    `${label} (button)`,
    action,
    typeof job === "string" && job ? { job } : {},
  );
  revalidatePath("/app", "layout");
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
