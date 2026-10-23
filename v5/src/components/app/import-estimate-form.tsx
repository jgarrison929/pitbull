"use client";

import { useActionState, useState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";
import { ESTIMATE_COLUMNS, MAX_CSV_CHARS } from "@/lib/estimate-reconcile";

/**
 * Reads the chosen file in the browser and posts its text as `csv` to estimate.importCsv,
 * the same run() path the assistant uses. A File would not survive argsFromForm, which reads strings.
 */
export function ImportEstimateForm({ jobNumber }: { jobNumber: string }) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );

  // Remount the picker after a successful import so the next file is chosen deliberately.
  const pickerKey =
    state.summary?.startsWith("Imported the estimate") &&
    !state.detailLines?.length
      ? state.summary
      : "idle";

  return (
    <form
      action={dispatch}
      className="mb-3 flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-xs"
      data-testid="import-estimate-form"
    >
      <input type="hidden" name="action" value="estimate.importCsv" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="label" value="Import estimate" />
      <ImportPicker key={pickerKey} pending={pending} />
      <p className="text-muted-foreground">
        One row per cost item with the header{" "}
        <code className="break-all">{ESTIMATE_COLUMNS.join(",")}</code>. Summary
        rows leave unit, quantity, and costs blank. Importing again updates
        matching codes in place, and nothing is written if any row has an
        error.
      </p>
      {state.summary ? (
        <p className="text-foreground" data-testid="import-estimate-summary">
          {state.summary}
        </p>
      ) : null}
      {state.detailLines?.length ? (
        <ul
          className="list-disc space-y-1 pl-4 text-foreground"
          data-testid="import-estimate-errors"
        >
          {state.detailLines.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function ImportPicker({ pending }: { pending: boolean }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [tooBig, setTooBig] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    setCsv("");
    setFileName("");
    setTooBig(null);
    if (!file) return;
    if (file.size > MAX_CSV_CHARS) {
      setTooBig(
        `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The import limit is ${MAX_CSV_CHARS / 1_000_000} MB.`,
      );
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
  }

  return (
    <>
      <input type="hidden" name="csv" value={csv} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="font-medium text-foreground">Import estimate</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => choose(e.target.files?.[0])}
            className="max-w-full text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs"
            data-testid="import-estimate-file"
          />
        </label>
        <button
          type="submit"
          disabled={!csv || pending}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-60"
          data-testid="import-estimate-submit"
        >
          {pending ? "Importing…" : "Import estimate"}
        </button>
        {fileName ? (
          <span data-testid="import-estimate-filename">{fileName}</span>
        ) : null}
      </div>
      {tooBig ? (
        <p className="text-foreground" data-testid="import-estimate-summary">
          {tooBig}
        </p>
      ) : null}
    </>
  );
}
