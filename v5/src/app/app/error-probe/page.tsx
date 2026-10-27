import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  ERROR_PROBE_MESSAGE,
  ERROR_PROBE_OK_COOKIE,
  isErrorProbeAllowed,
} from "@/lib/error-probe";

/**
 * Gated throw for AppShell error-boundary checks (e2e / verify).
 * Unlinked — not in the nav crawl. Off unless `V5_ERROR_PROBE=1`.
 * Production/Railway leave the flag unset; proxy returns HTTP 404 before this
 * page streams (page-level notFound() alone can still commit 200 under the
 * app shell). With cookie `pcs_error_probe_ok=1`, renders a recovered marker
 * so Try again can be proven to re-fetch (a no-op button stays on the error UI).
 */
export default async function ErrorProbePage() {
  if (!isErrorProbeAllowed()) notFound();
  const jar = await cookies();
  if (jar.get(ERROR_PROBE_OK_COOKIE)?.value === "1") {
    return (
      <p data-testid="error-probe-recovered">Probe recovered after retry</p>
    );
  }
  throw new Error(ERROR_PROBE_MESSAGE);
}
