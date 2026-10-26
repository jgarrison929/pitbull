import { notFound } from "next/navigation";

/**
 * Gated throw for AppShell error-boundary checks (e2e / verify).
 * Unlinked — not in the nav crawl. Off unless `V5_ERROR_PROBE=1`.
 */
export default function ErrorProbePage() {
  if (process.env.V5_ERROR_PROBE !== "1") notFound();
  throw new Error("Forced route throw for error-boundary probe");
}
