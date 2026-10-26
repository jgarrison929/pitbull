"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  sandboxForVisitor,
  resetSandbox,
  sweepExpiredSandboxes,
} from "@/server/sandbox";
import {
  endSession,
  getCurrentUser,
  requireUser,
  startSession,
  visitorHash,
  type Role,
} from "@/server/session";

const roles: Role[] = ["executive", "pm", "superintendent", "foreman"];

/**
 * Role-card login. Switching roles keeps the sandbox. A signed-out visitor
 * gets a fresh one, up to MAX_SANDBOXES_PER_VISITOR, then their newest.
 * Does not redirect — the login form hard-navigates to `/app` so the login
 * page unmounts (soft `redirect()` left a hidden login `main` in the tree).
 */
export async function signIn(
  formData: FormData,
): Promise<{ ok: true } | { ok: false }> {
  const role = formData.get("role");
  if (typeof role !== "string" || !roles.includes(role as Role)) {
    return { ok: false };
  }
  const current = await getCurrentUser();
  // Do not await a full expired-sandbox cascade on the critical path: under a
  // busy staging DB that DELETE can stall past the verify crawl's 20s
  // waitForURL(/\/app/). Role switch reuses the session company; new visitors
  // still get a sandbox. Sweep runs best-effort in the background (and on
  // Reset demo) so TTL cleanup continues without blocking sign-in.
  if (!current) {
    void sweepExpiredSandboxes().catch(() => {});
  }
  const companyId =
    current?.companyId ?? (await sandboxForVisitor(await visitorHash()));
  await startSession(companyId, role as Role);
  return { ok: true };
}

export async function resetDemo() {
  const user = await requireUser();
  await resetSandbox(user.companyId);
  // The shell layout shows sandbox data, so drop every cached segment under /app, not just the page.
  revalidatePath("/app", "layout");
  redirect("/app?reset=1");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
