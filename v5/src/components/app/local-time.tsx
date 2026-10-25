"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Server renders UTC; the browser shows the visitor's own time zone. */
export function LocalTime({ iso, testId }: { iso: string; testId?: string }) {
  const label = useSyncExternalStore(
    noop,
    () =>
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    () => `${iso.slice(0, 16).replace("T", " ")} UTC`,
  );
  return (
    <time dateTime={iso} data-testid={testId}>
      {label}
    </time>
  );
}
