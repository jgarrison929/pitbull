"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Server renders UTC (or a fixed zone); the browser shows that zone or the visitor's. */
export function LocalTime({
  iso,
  testId,
  timeZone,
}: {
  iso: string;
  testId?: string;
  /** When set, format in this zone (e.g. company America/Los_Angeles). */
  timeZone?: string;
}) {
  const label = useSyncExternalStore(
    noop,
    () =>
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        ...(timeZone ? { timeZone } : {}),
      }),
    () =>
      timeZone
        ? new Date(iso).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone,
          })
        : `${iso.slice(0, 16).replace("T", " ")} UTC`,
  );
  return (
    <time dateTime={iso} data-testid={testId}>
      {label}
    </time>
  );
}
