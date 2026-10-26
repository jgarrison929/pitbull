/**
 * Microsoft Project XML → ScheduleImportDraft (5.1.3-b).
 * Binary .MPP is out of scope. Namespace-agnostic element names.
 * Apply via shared `importScheduleDraft` / `applyScheduleImportDraft` (5.1.3-a).
 */
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
} from "@/lib/schedule";
import {
  MAX_SCHEDULE_IMPORT_BYTES,
  type ScheduleImportDraft,
  type ScheduleImportLinkType,
  type ScheduleImportParseResult,
  type ScheduleImportSkipped,
} from "./types";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** MSP PredecessorLink Type: 0=FF, 1=FS, 2=SS, 3=SF. */
const LINK_TYPE_BY_CODE: Record<
  number,
  ScheduleImportLinkType | "unsupported"
> = {
  0: "unsupported", // finish_to_finish
  1: "finish_to_start",
  2: "start_to_start",
  3: "unsupported", // start_to_finish
};

/** MSP ConstraintType. ASAP (0) silent; SNET (4) feeds startOn when Start is absent. */
const CONSTRAINT_ASAP = 0;
const CONSTRAINT_SNET = 4;

type XmlElement = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
};

type XmlText = { text: string };
type XmlNode = XmlElement | XmlText;

function isElement(n: XmlNode): n is XmlElement {
  return "name" in n;
}

function localName(raw: string): string {
  const i = raw.indexOf(":");
  return (i >= 0 ? raw.slice(i + 1) : raw).toLowerCase();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
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

/**
 * Minimal XML element tree for MSP Project files (no external dependency).
 * Ignores comments, processing instructions, and DOCTYPE.
 */
export function parseXmlTree(xml: string): XmlElement {
  const tokens = xml.match(
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[^>]+>|[^<]+/g,
  );
  if (!tokens) throw new Error("Empty XML");

  const root: XmlElement = { name: "#document", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];

  for (const raw of tokens) {
    if (
      raw.startsWith("<!--") ||
      raw.startsWith("<?") ||
      raw.startsWith("<!")
    ) {
      continue;
    }
    if (raw.startsWith("</")) {
      const name = localName(raw.slice(2, -1).trim());
      if (stack.length <= 1)
        throw new Error(`Unexpected closing tag </${name}>`);
      const top = stack.pop()!;
      if (top.name !== name) {
        throw new Error(
          `Mismatched tag: expected </${top.name}>, got </${name}>`,
        );
      }
      continue;
    }
    if (raw.startsWith("<")) {
      const selfClosing = /\/\s*>$/.test(raw);
      const body = raw.slice(1, selfClosing ? raw.lastIndexOf("/") : -1).trim();
      const m = /^([^\s/>]+)/.exec(body);
      if (!m) throw new Error(`Malformed tag: ${raw.slice(0, 40)}`);
      const name = localName(m[1]!);
      const attrs: Record<string, string> = {};
      const attrRe = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let am: RegExpExecArray | null;
      while ((am = attrRe.exec(body)) !== null) {
        attrs[localName(am[1]!)] = decodeEntities(am[2] ?? am[3] ?? "");
      }
      const el: XmlElement = { name, attrs, children: [] };
      stack[stack.length - 1]!.children.push(el);
      if (!selfClosing) stack.push(el);
      continue;
    }
    const text = decodeEntities(raw);
    if (text.trim()) {
      stack[stack.length - 1]!.children.push({ text });
    }
  }

  if (stack.length !== 1) {
    throw new Error("Unclosed XML element");
  }
  const project = root.children.find(
    (c): c is XmlElement => isElement(c) && c.name === "project",
  );
  if (!project)
    throw new Error("Microsoft Project XML must have a Project root");
  return project;
}

function childElements(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter(
    (c): c is XmlElement => isElement(c) && c.name === name,
  );
}

function firstChild(el: XmlElement, name: string): XmlElement | undefined {
  return childElements(el, name)[0];
}

function textOf(el: XmlElement | undefined): string {
  if (!el) return "";
  return el.children
    .map((c) => (isElement(c) ? textOf(c) : c.text))
    .join("")
    .trim();
}

function childText(el: XmlElement, name: string): string {
  return textOf(firstChild(el, name));
}

function childInt(el: XmlElement, name: string, fallback = 0): number {
  const raw = childText(el, name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function toIsoDay(raw: string): string | undefined {
  const m = ISO_DAY.exec(raw.trim());
  return m ? m[0]!.slice(0, 10) : undefined;
}

/**
 * Duration → whole working days.
 * Accepts PnD and PTnH…; MSP stores working duration (8 hours = 1 day).
 */
export function durationToWorkingDays(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const day = /^P(\d+(?:\.\d+)?)D$/i.exec(s);
  if (day) {
    const n = Math.round(Number(day[1]));
    return Number.isFinite(n) ? n : null;
  }
  const hours = /PT(\d+(?:\.\d+)?)H/i.exec(s);
  if (hours) {
    const h = Number(hours[1]);
    if (!Number.isFinite(h)) return null;
    return Math.max(1, Math.round(h / 8));
  }
  const minutes = /PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?/i.exec(s);
  if (minutes && (minutes[1] || minutes[2])) {
    const h = Number(minutes[1] ?? 0) + Number(minutes[2] ?? 0) / 60;
    if (!Number.isFinite(h)) return null;
    return Math.max(1, Math.round(h / 8));
  }
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 0) {
    if (asNum >= 4800) return Math.max(1, Math.round(asNum / 4800));
    return Math.max(1, Math.round(asNum));
  }
  return null;
}

/** LinkLag is tenths of a minute; 4800 = one 8-hour day. */
export function linkLagToDays(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return 0;
  return Math.max(0, Math.round(n / 4800));
}

function holidaysFromCalendar(
  cal: XmlElement,
  skipped: Map<string, { count: number; sample?: string }>,
): ScheduleImportDraft["holidays"] {
  const out: ScheduleImportDraft["holidays"] = [];
  const exceptions = firstChild(cal, "exceptions");
  if (!exceptions) return out;
  for (const ex of childElements(exceptions, "exception")) {
    const name = childText(ex, "name") || "Holiday";
    const period = firstChild(ex, "timeperiod");
    const from = period ? toIsoDay(childText(period, "fromdate")) : undefined;
    const to = period ? toIsoDay(childText(period, "todate")) : undefined;
    if (!from) {
      bump(skipped, "calendar_exception", name);
      continue;
    }
    const endExclusive = to && to > from ? to : undefined;
    if (!endExclusive) {
      out.push({ on: from, name });
      continue;
    }
    let cur = from;
    let guard = 0;
    while (cur < endExclusive && guard++ < 366) {
      out.push({ on: cur, name });
      const [y, m, d] = cur.split("-").map(Number) as [number, number, number];
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      cur = next.toISOString().slice(0, 10);
    }
  }
  return out;
}

function activityCode(task: XmlElement, uid: number): string {
  const wbs = childText(task, "wbs");
  if (wbs) return wbs;
  const outline = childText(task, "outlinenumber");
  if (outline) return outline;
  return String(uid);
}

/**
 * Parse Microsoft Project XML bytes into a schedule import draft.
 * Oversized files and unloadable XML return `{ error }` without throwing.
 */
export function parseMspXml(bytes: Uint8Array): ScheduleImportParseResult {
  if (bytes.byteLength > MAX_SCHEDULE_IMPORT_BYTES) {
    return {
      error: `Schedule file is over ${MAX_SCHEDULE_IMPORT_BYTES / 1_000_000} MB and was refused before parse.`,
    };
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return { error: "Could not read the Microsoft Project XML as UTF-8 text." };
  }

  let project: XmlElement;
  try {
    project = parseXmlTree(text);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Invalid Microsoft Project XML: ${e.message}`
          : "Invalid Microsoft Project XML.",
    };
  }

  const skippedMap = new Map<string, { count: number; sample?: string }>();
  const draft: ScheduleImportDraft = {
    activities: [],
    links: [],
    holidays: [],
    skipped: [],
  };

  const calendars = firstChild(project, "calendars");
  if (calendars) {
    const cals = childElements(calendars, "calendar");
    const base =
      cals.find((c) => childInt(c, "isbasecalendar", 0) === 1) ?? cals[0];
    if (base) {
      draft.holidays = holidaysFromCalendar(base, skippedMap);
    }
  }

  const tasksEl = firstChild(project, "tasks");
  if (!tasksEl) {
    return { error: "Microsoft Project XML has no Tasks." };
  }

  const uidToCode = new Map<number, string>();
  const tasks = childElements(tasksEl, "task");

  for (const task of tasks) {
    const uid = childInt(task, "uid", -1);
    if (uid < 0) continue;
    if (childInt(task, "isnull", 0) === 1) {
      bump(skippedMap, "null_task", `UID ${uid}`);
      continue;
    }
    if (childInt(task, "summary", 0) === 1) {
      bump(
        skippedMap,
        "summary_task",
        childText(task, "name") || `UID ${uid}`,
      );
      continue;
    }
    if (childInt(task, "milestone", 0) === 1 && !childText(task, "duration")) {
      bump(
        skippedMap,
        "milestone",
        childText(task, "name") || `UID ${uid}`,
      );
      continue;
    }

    const name = childText(task, "name") || `Task ${uid}`;
    const code = activityCode(task, uid);
    const durationRaw = childText(task, "duration");
    let durationDays = durationToWorkingDays(durationRaw);
    if (durationDays === null) {
      if (childText(task, "start") && childText(task, "finish")) {
        durationDays = 1;
      } else {
        bump(skippedMap, "missing_duration", code);
        continue;
      }
    }
    if (
      durationDays < ACTIVITY_DURATION_MIN_DAYS ||
      durationDays > ACTIVITY_DURATION_MAX_DAYS
    ) {
      bump(skippedMap, "duration_out_of_range", code);
      continue;
    }

    const constraintType = childInt(task, "constrainttype", CONSTRAINT_ASAP);
    const constraintDate = toIsoDay(childText(task, "constraintdate"));
    let startOn = toIsoDay(childText(task, "start"));

    if (constraintType === CONSTRAINT_ASAP) {
      // supported no-op
    } else if (constraintType === CONSTRAINT_SNET && constraintDate) {
      // Shared draft has no startNoEarlierOn — use as start hint when Start absent.
      if (!startOn) startOn = constraintDate;
    } else if (constraintType !== CONSTRAINT_ASAP) {
      bump(skippedMap, "constraint", `${code} type ${constraintType}`);
    }

    if (firstChild(task, "extendedattribute")) {
      bump(skippedMap, "extended_attribute", code);
    }

    draft.activities.push({
      code,
      name,
      durationDays,
      ...(startOn ? { startOn } : {}),
    });
    uidToCode.set(uid, code);
  }

  for (const task of tasks) {
    const uid = childInt(task, "uid", -1);
    const successorCode = uidToCode.get(uid);
    if (!successorCode) continue;
    for (const link of childElements(task, "predecessorlink")) {
      const predUid = childInt(link, "predecessoruid", -1);
      const predCode = uidToCode.get(predUid);
      const typeCode = childInt(link, "type", 1);
      const mapped = LINK_TYPE_BY_CODE[typeCode];
      if (!predCode) {
        // Keep raw id so apply can name the missing activity (same pattern as XER).
        draft.links.push({
          predecessorCode: String(predUid),
          successorCode,
          type: "finish_to_start",
          lagDays: linkLagToDays(childText(link, "linklag")),
        });
        continue;
      }
      if (!mapped || mapped === "unsupported") {
        bump(
          skippedMap,
          "unsupported_link_type",
          `${predCode} → ${successorCode} type ${typeCode}`,
        );
        continue;
      }
      draft.links.push({
        predecessorCode: predCode,
        successorCode,
        type: mapped,
        lagDays: linkLagToDays(childText(link, "linklag")),
      });
    }
  }

  if (firstChild(project, "resources")) {
    const resources = firstChild(project, "resources")!;
    const n = childElements(resources, "resource").length;
    if (n > 0) bump(skippedMap, "resource", `${n} resources`);
  }
  if (firstChild(project, "assignments")) {
    const assignments = firstChild(project, "assignments")!;
    const n = childElements(assignments, "assignment").length;
    if (n > 0) bump(skippedMap, "assignment", `${n} assignments`);
  }

  draft.skipped = toSkipped(skippedMap);

  if (draft.activities.length === 0) {
    return {
      error: "No importable activities found in the Microsoft Project XML.",
    };
  }

  return draft;
}

/** Convenience for tests and typed actions that already have a string. */
export function parseMspXmlText(text: string): ScheduleImportParseResult {
  return parseMspXml(new TextEncoder().encode(text));
}
