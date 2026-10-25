"use client";

import Link from "next/link";
import { useEffect } from "react";

type RouteErrorFallbackProps = {
  error: unknown;
  retry: () => void;
  /** `global` replaces the root shell; `route` keeps the surrounding layout. */
  scope: "route" | "global";
};

function errorDigest(error: unknown): string | undefined {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === "string" && digest.length > 0 ? digest : undefined;
  }
  return undefined;
}

/**
 * Honest recovery UI for App Router error boundaries.
 * Copy matches product failure tone ("Reset failed, try again") — real recovery actions only.
 */
export function RouteErrorFallback({
  error,
  retry,
  scope,
}: RouteErrorFallbackProps) {
  const digest = errorDigest(error);

  useEffect(() => {
    console.error(scope === "global" ? "[global-error]" : "[error]", error);
  }, [error, scope]);

  const title =
    scope === "global" ? "Shell load failed" : "Page load failed";
  const detail =
    scope === "global"
      ? "Pitbull could not render the app shell. Try again. If it keeps failing, open the demo login and pick a role."
      : "This screen failed to render. Try again. If it keeps failing, open the demo login and pick a role.";

  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16"
      data-testid={scope === "global" ? "global-error" : "route-error"}
    >
      <div className="flex flex-col gap-3 rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 px-4">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            P
          </div>
          <span className="font-semibold">Pitbull</span>
        </div>
        <div className="flex flex-col gap-1 px-4">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
        {digest ? (
          <p className="px-4 font-mono text-xs break-all text-muted-foreground">
            Error id {digest}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-4 py-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Demo login
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Construction project controls. Demo data only.
      </p>
    </main>
  );
}
