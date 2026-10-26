"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  runScheduleImportState,
  type ScheduleImportState,
} from "@/app/app/assistant/schedule-import-action";
import { MAX_SCHEDULE_IMPORT_BYTES } from "@/lib/schedule-import/types";

/**
 * PM schedule import on `/app/jobs/[number]/schedule`.
 * Posts the chosen File through a dedicated server action (multipart binary)
 * into `schedule.importXer` / `schedule.importMspXml` — same run() audit path
 * as the assistant, without stuffing 10 MB into a string JobArg.
 */
export function ImportScheduleForm({ jobNumber }: { jobNumber: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, dispatch, pending] = useActionState<
    ScheduleImportState,
    FormData
  >(async (prev, fd) => {
    const file = inputRef.current?.files?.[0];
    if (file) {
      if (file.size > MAX_SCHEDULE_IMPORT_BYTES) {
        return {
          summary: `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The schedule import limit is ${MAX_SCHEDULE_IMPORT_BYTES / 1_000_000} MB.`,
        };
      }
      fd.set("upload", file);
      fd.set("fileName", file.name);
      const action = actionForFileName(file.name);
      if (action) fd.set("action", action);
    }
    return runScheduleImportState(prev, fd);
  }, {});

  const pickerKey =
    state.summary?.startsWith("Imported schedule") && !state.skipped?.length
      ? state.summary
      : state.summary?.startsWith("Imported schedule")
        ? `${state.summary}:${state.skipped?.length ?? 0}`
        : "idle";

  return (
    <form
      action={dispatch}
      className="mb-3 flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-xs"
      data-testid="import-schedule-form"
    >
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="label" value="Import schedule" />
      <ImportPicker key={pickerKey} pending={pending} inputRef={inputRef} />
      <p className="text-muted-foreground">
        Primavera P6 <code className="break-all">.xer</code> or Microsoft
        Project <code className="break-all">.xml</code> (not binary{" "}
        <code className="break-all">.mpp</code>). Import is all-or-nothing:
        one bad relationship writes nothing. Unsupported constructs are listed
        below with counts — they do not fail the import by themselves. Cost
        items are not linked from Schedule IDs; link them after import.
      </p>
      {state.summary ? (
        <p className="text-foreground" data-testid="import-schedule-summary">
          {state.summary}
        </p>
      ) : null}
      {state.detailLines?.length ? (
        <ul
          className="list-disc space-y-1 pl-4 text-foreground"
          data-testid="import-schedule-errors"
        >
          {state.detailLines.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {state.skipped?.length ? (
        <div data-testid="import-schedule-skipped">
          <p className="font-medium text-foreground">Skipped constructs</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-foreground">
            {state.skipped.map((s, i) => (
              <li
                key={`${i}-${s.kind}`}
                data-testid="import-schedule-skipped-row"
                data-kind={s.kind}
                data-count={s.count}
              >
                {s.count === 1 ? "1 row" : `${s.count} rows`} of {s.kind}
                {s.sample?.trim() ? ` (e.g. ${s.sample.trim()})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function actionForFileName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xer")) return "schedule.importXer";
  if (lower.endsWith(".xml")) return "schedule.importMspXml";
  return null;
}

function ImportPicker({
  pending,
  inputRef,
}: {
  pending: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [fileName, setFileName] = useState("");
  const [action, setAction] = useState("schedule.importXer");
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [tooBig, setTooBig] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function choose(file: File | undefined) {
    setTooBig(null);
    if (!file) {
      setFileName("");
      setReady(false);
      return;
    }
    setFileName(file.name);
    const next = actionForFileName(file.name);
    if (next) setAction(next);
    if (file.size > MAX_SCHEDULE_IMPORT_BYTES) {
      setReady(false);
      setTooBig(
        `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The schedule import limit is ${MAX_SCHEDULE_IMPORT_BYTES / 1_000_000} MB.`,
      );
      return;
    }
    setReady(Boolean(next));
  }

  useEffect(() => {
    const file = inputRef.current?.files?.[0];
    if (file) choose(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydration sync
  }, []);

  const canImport = ready && !pending && !tooBig;

  return (
    <>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="mode" value={mode} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="font-medium text-foreground">Import schedule</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xer,.xml,application/xml,text/xml"
            onChange={(e) => choose(e.target.files?.[0])}
            className="max-w-full text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs"
            data-testid="import-schedule-file"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-foreground">Mode</span>
          <select
            value={mode}
            onChange={(e) =>
              setMode(e.target.value === "merge" ? "merge" : "replace")
            }
            className="rounded-md border bg-background px-2 py-1.5 text-xs"
            data-testid="import-schedule-mode"
          >
            <option value="replace">Replace</option>
            <option value="merge">Merge</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={!canImport}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-60"
          data-testid="import-schedule-submit"
        >
          {pending ? "Importing…" : "Import schedule"}
        </button>
        {fileName ? (
          <span data-testid="import-schedule-filename">{fileName}</span>
        ) : null}
      </div>
      {tooBig ? (
        <p className="text-foreground" data-testid="import-schedule-summary">
          {tooBig}
        </p>
      ) : null}
      {fileName && !actionForFileName(fileName) && !tooBig ? (
        <p className="text-foreground" data-testid="import-schedule-summary">
          Choose a .xer or .xml file. Binary .mpp is not supported.
        </p>
      ) : null}
    </>
  );
}
