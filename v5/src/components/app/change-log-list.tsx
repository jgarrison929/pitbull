"use client";

import { useState } from "react";
import { LocalTime } from "@/components/app/local-time";
import {
  ChangesFilterEmpty,
  ChangesNothingYet,
  type AppRole,
} from "@/components/app/list-empty";

export type ChangeLogRow = {
  id: string;
  userName: string;
  summary: string;
  createdAt: string;
  action: string;
};

/** Full job change log. An empty job and a filter with no rows are different states. */
export function ChangeLogList({
  changes,
  jobNumber,
  role,
  estimateApproved,
}: {
  changes: ChangeLogRow[];
  jobNumber: string;
  role: AppRole;
  estimateApproved: boolean;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  if (changes.length === 0) {
    return (
      <ChangesNothingYet
        role={role}
        jobNumber={jobNumber}
        estimateApproved={estimateApproved}
      />
    );
  }

  const shown = query
    ? changes.filter((c) =>
        `${c.userName} ${c.summary} ${c.action}`.toLowerCase().includes(query),
      )
    : changes;

  return (
    <div>
      <div className="py-3">
        <label
          htmlFor="changes-filter"
          className="text-xs font-medium text-muted-foreground"
        >
          Filter changes
        </label>
        <input
          id="changes-filter"
          data-testid="changes-filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, cost code, or summary"
          className="mt-1 w-full min-h-11 rounded-md border bg-background px-3 text-base"
        />
      </div>
      {shown.length === 0 ? (
        <ChangesFilterEmpty onClear={() => setQ("")} />
      ) : (
        <>
          <ul className="divide-y text-sm" data-testid="job-changes-full">
            {shown.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-medium">{c.userName}</span> · {c.summary}{" "}
                <span className="text-xs text-muted-foreground">
                  <LocalTime iso={c.createdAt} />
                </span>
              </li>
            ))}
          </ul>
          {query ? (
            <p className="py-2 text-xs text-muted-foreground">
              {shown.length} on this page match
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
