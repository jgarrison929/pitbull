/**
 * Pure Primavera P6 XER parser for 5.1.3-a.
 * Reads TASK / TASKPRED / CALENDAR (+ optional NONWORKDAYS) into ScheduleImportDraft.
 * Unknown tables and unsupported constructs are counted in `skipped`, not invented.
 */
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
} from "@/lib/schedule";
import {
  SCHEDULE_IMPORT_MAX_BYTES,
  type ScheduleImportDraft,
  type ScheduleImportLink,
  type ScheduleImportLinkType,
  type ScheduleImportParseResult,
  type ScheduleImportSkipped,
} from "./types";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

type Table = { name: string; fields: string[]; rows: string[][] };

function decodeBytes(bytes: Uint8Array): string | { error: string } {
  if (bytes.byteLength > SCHEDULE_IMPORT_MAX_BYTES) {
    return {
      error: `Schedule file is over ${SCHEDULE_IMPORT_MAX_BYTES / (1024 * 1024)} MB and was refused before parse.`,
    };
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // P6 often exports Windows-1252; fall back without failing ASCII fixtures.
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      return { error: "Couldn't decode the XER file as text." };
    }
  }
}

function parseTables(text: string): Table[] | { error: string } {
  const lines = text.split(/\r?\n/);
  const tables: Table[] = [];
  let current: Table | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("ERMHDR")) continue;
    if (line.startsWith("%E")) break;

    if (line.startsWith("%T")) {
      const name = line.slice(2).trim().split(/\t/)[0]?.trim();
      if (!name) return { error: `XER table name missing on line ${i + 1}.` };
      current = { name: name.toUpperCase(), fields: [], rows: [] };
      tables.push(current);
      continue;
    }
    if (!current) continue;

    if (line.startsWith("%F")) {
      current.fields = line.slice(2).split("\t").map((f) => f.trim());
      continue;
    }
    if (line.startsWith("%R")) {
      const cells = line.slice(2).split("\t");
      // Pad / trim to field count so missing trailing tabs stay empty.
      const row = current.fields.map((_, idx) => cells[idx] ?? "");
      current.rows.push(row);
    }
  }

  if (tables.length === 0) {
    return { error: "XER file has no tables." };
  }
  return tables;
}

function col(fields: string[], row: string[], name: string): string {
  const i = fields.findIndex((f) => f.toLowerCase() === name.toLowerCase());
  return i < 0 ? "" : (row[i] ?? "").trim();
}

function bump(
  skipped: Map<string, { count: number; sample?: string }>,
  kind: string,
  sample?: string,
) {
  const cur = skipped.get(kind) ?? { count: 0 };
  cur.count += 1;
  if (sample && !cur.sample) cur.sample = sample;
  skipped.set(kind, cur);
}

function toSkipped(
  map: Map<string, { count: number; sample?: string }>,
): ScheduleImportSkipped[] {
  return [...map.entries()]
    .map(([kind, v]) => ({
      kind,
      count: v.count,
      ...(v.sample ? { sample: v.sample } : {}),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

function dayHoursFromCalendars(tables: Table[]): number {
  const cal = tables.find((t) => t.name === "CALENDAR");
  if (!cal) return 8;
  for (const row of cal.rows) {
    const hours = Number(col(cal.fields, row, "day_hr_cnt"));
    if (Number.isFinite(hours) && hours > 0) return hours;
  }
  return 8;
}

function isoDay(raw: string): string | undefined {
  const m = raw.match(ISO_DAY);
  return m ? m[0] : undefined;
}

function hoursToWholeDays(hours: number, dayHours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return ACTIVITY_DURATION_MIN_DAYS;
  const days = Math.round(hours / dayHours);
  return Math.min(
    ACTIVITY_DURATION_MAX_DAYS,
    Math.max(ACTIVITY_DURATION_MIN_DAYS, days || ACTIVITY_DURATION_MIN_DAYS),
  );
}

function lagDaysFromHours(hours: number, dayHours: number): number {
  if (!Number.isFinite(hours)) return 0;
  return Math.trunc(hours / dayHours);
}

function predType(raw: string): ScheduleImportLinkType | "unsupported" | null {
  const t = raw.trim().toUpperCase();
  if (!t) return "finish_to_start";
  if (t === "PR_FS" || t === "FS") return "finish_to_start";
  if (t === "PR_SS" || t === "SS") return "start_to_start";
  if (t === "PR_FF" || t === "FF" || t === "PR_SF" || t === "SF") {
    return "unsupported";
  }
  return "unsupported";
}

function isTaskActivity(taskType: string): boolean {
  const t = taskType.trim().toUpperCase();
  return t === "" || t === "TT_TASK" || t === "TASK";
}

function isConstraintSkipped(cstrType: string): boolean {
  const t = cstrType.trim().toUpperCase();
  if (!t || t === "CS_ASAP" || t === "ASAP" || t === "0") return false;
  return true;
}

const KNOWN_TABLES = new Set([
  "PROJECT",
  "CALENDAR",
  "TASK",
  "TASKPRED",
  "PROJWBS",
  "SCHEDOPTIONS",
  "NONWORKDAYS",
  "CURRTYPE",
  "MEASUREUNIT",
  "RSRC",
  "TASKRSRC",
  "UDFTYPE",
  "UDFVALUE",
  "ACTVTYPE",
  "ACTVCODE",
  "TASKACTV",
]);

/**
 * Parse a P6 XER into a schedule import draft.
 * Does not touch the database. Link targets are resolved by task_code;
 * a missing code fails later at apply (all-or-nothing).
 */
export function parseXer(bytes: Uint8Array): ScheduleImportParseResult {
  const decoded = decodeBytes(bytes);
  if (typeof decoded !== "string") return decoded;

  const tables = parseTables(decoded);
  if ("error" in tables) return tables;

  const skippedMap = new Map<string, { count: number; sample?: string }>();
  for (const t of tables) {
    if (!KNOWN_TABLES.has(t.name)) {
      bump(skippedMap, `table:${t.name.toLowerCase()}`, `${t.rows.length} rows`);
    }
  }

  const dayHours = dayHoursFromCalendars(tables);
  const cal = tables.find((t) => t.name === "CALENDAR");
  if (cal) {
    for (const row of cal.rows) {
      const data = col(cal.fields, row, "clndr_data");
      if (data) bump(skippedMap, "calendar_data", "clndr_data");
    }
  }

  const taskTable = tables.find((t) => t.name === "TASK");
  if (!taskTable || taskTable.rows.length === 0) {
    return { error: "XER file has no TASK rows." };
  }

  const idToCode = new Map<string, string>();
  const activities: ScheduleImportDraft["activities"] = [];
  const seenCodes = new Set<string>();

  for (const row of taskTable.rows) {
    const taskId = col(taskTable.fields, row, "task_id");
    const code = col(taskTable.fields, row, "task_code");
    const name = col(taskTable.fields, row, "task_name") || code;
    const taskType = col(taskTable.fields, row, "task_type");
    const cstrType = col(taskTable.fields, row, "cstr_type");
    const durationHrs = Number(
      col(taskTable.fields, row, "target_drtn_hr_cnt") || "0",
    );
    const startRaw =
      col(taskTable.fields, row, "target_start_date") ||
      col(taskTable.fields, row, "early_start_date") ||
      "";

    if (!isTaskActivity(taskType)) {
      const kind =
        taskType.toUpperCase().includes("MILE")
          ? "milestone"
          : taskType.toUpperCase().includes("WBS")
            ? "wbs"
            : taskType.toUpperCase().includes("LOE")
              ? "level_of_effort"
              : `task_type:${taskType || "unknown"}`;
      bump(skippedMap, kind, code || taskId || undefined);
      continue;
    }

    if (!code) {
      return { error: `TASK row missing task_code (task_id ${taskId || "?"}).` };
    }
    if (seenCodes.has(code)) {
      return { error: `Duplicate activity code "${code}" in the XER file.` };
    }
    seenCodes.add(code);
    if (taskId) idToCode.set(taskId, code);

    if (isConstraintSkipped(cstrType)) {
      bump(skippedMap, "constraint", `${code}:${cstrType}`);
    }

    const startOn = isoDay(startRaw);
    activities.push({
      code,
      name,
      durationDays: hoursToWholeDays(durationHrs, dayHours),
      ...(startOn ? { startOn } : {}),
    });
  }

  if (activities.length === 0) {
    return { error: "XER file has no importable activities." };
  }

  const links: ScheduleImportLink[] = [];
  const predTable = tables.find((t) => t.name === "TASKPRED");
  if (predTable) {
    for (const row of predTable.rows) {
      const succId = col(predTable.fields, row, "task_id");
      const predId = col(predTable.fields, row, "pred_task_id");
      const typeRaw = col(predTable.fields, row, "pred_type");
      const lagHrs = Number(col(predTable.fields, row, "lag_hr_cnt") || "0");
      const type = predType(typeRaw);
      if (type === "unsupported") {
        bump(
          skippedMap,
          "unsupported_link_type",
          `${predId || "?"}→${succId || "?"}:${typeRaw || "?"}`,
        );
        continue;
      }
      if (type === null) continue;

      const predecessorCode = idToCode.get(predId) ?? predId;
      const successorCode = idToCode.get(succId) ?? succId;
      // Keep raw ids when unmapped so apply can name the missing activity.
      links.push({
        predecessorCode,
        successorCode,
        type,
        lagDays: lagDaysFromHours(lagHrs, dayHours),
      });
    }
  }

  const holidays: ScheduleImportDraft["holidays"] = [];
  const nonwork = tables.find((t) => t.name === "NONWORKDAYS");
  if (nonwork) {
    for (const row of nonwork.rows) {
      const on =
        isoDay(col(nonwork.fields, row, "nonwork_date")) ||
        isoDay(col(nonwork.fields, row, "day_date"));
      if (!on) {
        bump(skippedMap, "holiday_row", "missing date");
        continue;
      }
      const name =
        col(nonwork.fields, row, "nonwork_name") ||
        col(nonwork.fields, row, "day_name") ||
        "";
      holidays.push({ on, name });
    }
  }

  return {
    activities,
    links,
    holidays,
    skipped: toSkipped(skippedMap),
  };
}
