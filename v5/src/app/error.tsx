"use client";

import { RouteErrorFallback } from "@/components/app/route-error-fallback";

/**
 * Root segment boundary — keeps root layout only.
 * `/app` routes use `app/app/error.tsx` so AppShell stays visible.
 */
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <RouteErrorFallback error={error} retry={retry} scope="route" />;
}
