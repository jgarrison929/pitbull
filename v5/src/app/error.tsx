"use client";

import { RouteErrorFallback } from "@/components/app/route-error-fallback";

/** Segment error boundary — keeps root layout; offers retry. */
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <RouteErrorFallback error={error} retry={retry} scope="route" />;
}
