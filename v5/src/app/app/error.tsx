"use client";

import { RouteErrorFallback } from "@/components/app/route-error-fallback";

/**
 * `/app` segment boundary — keeps `app/layout.tsx` (AppShell: user menu, job
 * strip, phone tab bar) while the page recovers.
 */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <RouteErrorFallback error={error} retry={retry} scope="route" />;
}
