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

/** Role-card login. Switching roles keeps the sandbox. A signed-out visitor gets a fresh one, up to MAX_SANDBOXES_PER_VISITOR, then their newest. */
export async function signIn(formData: FormData) {
  const role = formData.get("role");
  if (typeof role !== "string" || !roles.includes(role as Role))
    redirect("/login");
  await sweepExpiredSandboxes();
  const current = await getCurrentUser();
  const companyId =
    current?.companyId ?? (await sandboxForVisitor(await visitorHash()));
  await startSession(companyId, role as Role);
  redirect("/app");
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
