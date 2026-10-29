"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";
import { ESTIMATE_COLUMNS, MAX_CSV_CHARS } from "@/lib/estimate-reconcile";

/**
 * Reads the chosen file in the browser and posts its text as `csv` to estimate.importCsv,
 * the same run() path the assistant uses. A File would not survive argsFromForm, which reads strings.
 *
 * Hydration-safe: a file chosen on the SSR HTML before React attaches onChange stays on the
 * native input. We sync from input.files after mount (so Import enables) and again inside the
 * form action on submit (so an early pick still posts csv even if state lagged).
 */
export function ImportEstimateForm({ jobNumber }: { jobNumber: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, dispatch, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const file = inputRef.current?.files?.[0];
      if (file) {
        if (file.size > MAX_CSV_CHARS) {
          return {
            summary: `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The import limit is ${MAX_CSV_CHARS / 1_000_000} MB.`,
          };
        }
        fd.set("csv", await file.text());
      }
      return runActionState(prev, fd);
    },
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
      className="mb-3 flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-body"
      data-testid="import-estimate-form"
    >
      <input type="hidden" name="action" value="estimate.importCsv" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="label" value="Import estimate" />
      <ImportPicker key={pickerKey} pending={pending} inputRef={inputRef} />
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

function ImportPicker({
  pending,
  inputRef,
}: {
  pending: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [tooBig, setTooBig] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  /**
   * Load a native File into React state. Filename shows immediately so an early
   * pick is visible; Import enables once the text is ready.
   */
  async function choose(file: File | undefined) {
    setTooBig(null);
    if (!file) {
      setCsv("");
      setFileName("");
      setReading(false);
      return;
    }
    setFileName(file.name);
    if (file.size > MAX_CSV_CHARS) {
      setCsv("");
      setReading(false);
      setTooBig(
        `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The import limit is ${MAX_CSV_CHARS / 1_000_000} MB.`,
      );
      return;
    }
    setReading(true);
    try {
      setCsv(await file.text());
    } finally {
      setReading(false);
    }
  }

  // Pre-hydration choose: native files are present but onChange never ran.
  useEffect(() => {
    const file = inputRef.current?.files?.[0];
    if (file) void choose(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydration sync
  }, []);

  const canImport = Boolean(csv) && !pending && !reading;

  return (
    <>
      <input type="hidden" name="csv" value={csv} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span
            className="text-label font-medium text-foreground"
            data-text="label"
          >
            Import estimate
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void choose(e.target.files?.[0])}
            className="max-w-full text-body file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-body max-[640px]:min-h-11"
            data-testid="import-estimate-file"
          />
        </label>
        <button
          type="submit"
          disabled={!canImport}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-60"
          data-testid="import-estimate-submit"
        >
          {pending || reading ? "Importing…" : "Import estimate"}
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
