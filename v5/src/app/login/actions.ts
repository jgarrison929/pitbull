"use server";

import { redirect } from "next/navigation";
import {
  createSandbox,
  resetSandbox,
  sweepExpiredSandboxes,
} from "@/server/sandbox";
import {
  endSession,
  getCurrentUser,
  requireUser,
  startSession,
  type Role,
} from "@/server/session";

const roles: Role[] = ["executive", "pm", "superintendent", "foreman"];

/** Role-card login. A visitor keeps their sandbox when switching roles; a new visitor gets a fresh one. */
export async function signIn(formData: FormData) {
  const role = formData.get("role");
  if (typeof role !== "string" || !roles.includes(role as Role))
    redirect("/login");
  await sweepExpiredSandboxes();
  const current = await getCurrentUser();
  const companyId = current?.companyId ?? (await createSandbox());
  await startSession(companyId, role as Role);
  redirect("/app");
}

export async function resetDemo() {
  const user = await requireUser();
  await resetSandbox(user.companyId);
  redirect("/app?reset=1");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
