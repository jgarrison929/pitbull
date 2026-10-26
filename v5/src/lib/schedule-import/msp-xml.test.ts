import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  durationToWorkingDays,
  isScheduleImportParseErr,
  linkLagToDays,
  parseMspXml,
  parseMspXmlText,
  MAX_SCHEDULE_IMPORT_BYTES,
} from "@/lib/schedule-import";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "fixtures/schedule", name), "utf8");

describe("durationToWorkingDays / linkLagToDays", () => {
  it("maps PT hours at 8h/day and PnD", () => {
    expect(durationToWorkingDays("PT40H0M0S")).toBe(5);
    expect(durationToWorkingDays("PT24H0M0S")).toBe(3);
    expect(durationToWorkingDays("P2D")).toBe(2);
  });

  it("maps LinkLag tenths-of-minute to whole days", () => {
    expect(linkLagToDays("0")).toBe(0);
    expect(linkLagToDays("4800")).toBe(1);
    expect(linkLagToDays("9600")).toBe(2);
  });
});

describe("parseMspXml", () => {
  it("parses cedar-ok.xml into A–E with FS links and skipped constraint", () => {
    const draft = parseMspXmlText(fixture("cedar-ok.xml"));
    expect(isScheduleImportParseErr(draft)).toBe(false);
    if (isScheduleImportParseErr(draft)) return;

    expect(draft.activities.map((a) => a.code)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(draft.activities.find((a) => a.code === "A")).toMatchObject({
      name: "Drive piles",
      durationDays: 5,
      startOn: "2026-11-02",
    });
    expect(draft.activities.find((a) => a.code === "B")?.durationDays).toBe(3);
    expect(draft.activities.find((a) => a.code === "C")?.durationDays).toBe(4);
    expect(draft.activities.find((a) => a.code === "D")?.durationDays).toBe(2);
    expect(draft.activities.find((a) => a.code === "E")?.durationDays).toBe(2);

    expect(draft.links).toEqual(
      expect.arrayContaining([
        {
          predecessorCode: "A",
          successorCode: "B",
          type: "finish_to_start",
          lagDays: 0,
        },
        {
          predecessorCode: "A",
          successorCode: "C",
          type: "finish_to_start",
          lagDays: 0,
        },
        {
          predecessorCode: "B",
          successorCode: "D",
          type: "finish_to_start",
          lagDays: 0,
        },
        {
          predecessorCode: "C",
          successorCode: "D",
          type: "finish_to_start",
          lagDays: 0,
        },
      ]),
    );
    expect(draft.links).toHaveLength(4);

    expect(draft.holidays).toEqual([
      { on: "2026-11-26", name: "Thanksgiving" },
    ]);

    const constraint = draft.skipped.find((s) => s.kind === "constraint");
    expect(constraint).toMatchObject({ count: 1 });
    expect(constraint?.sample).toMatch(/E/);

    expect(
      draft.skipped.find((s) => s.kind === "summary_task")?.count,
    ).toBeGreaterThanOrEqual(1);
  });

  it("counts skipped constraint rows without failing the draft (CI check 8)", () => {
    const xml = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Tasks>
    <Task>
      <UID>1</UID><WBS>A</WBS><Name>Only</Name>
      <Duration>PT8H0M0S</Duration><Summary>0</Summary>
      <ConstraintType>3</ConstraintType>
      <ConstraintDate>2026-11-02T08:00:00</ConstraintDate>
      <Start>2026-11-02T08:00:00</Start>
    </Task>
  </Tasks>
</Project>`;
    const draft = parseMspXmlText(xml);
    expect(isScheduleImportParseErr(draft)).toBe(false);
    if (isScheduleImportParseErr(draft)) return;
    expect(draft.activities).toHaveLength(1);
    expect(draft.skipped.find((s) => s.kind === "constraint")?.count).toBe(1);
  });

  it("refuses files over 10 MB before parse (CI check 9)", () => {
    const over = new Uint8Array(MAX_SCHEDULE_IMPORT_BYTES + 1);
    over.fill(32);
    const result = parseMspXml(over);
    expect(isScheduleImportParseErr(result)).toBe(true);
    if (!isScheduleImportParseErr(result)) return;
    expect(result.error).toMatch(/10 MB/);
  });

  it("keeps a missing predecessor id so apply refuses all-or-nothing", () => {
    const draft = parseMspXmlText(fixture("cedar-missing-pred.xml"));
    expect(isScheduleImportParseErr(draft)).toBe(false);
    if (isScheduleImportParseErr(draft)) return;
    expect(draft.links).toContainEqual(
      expect.objectContaining({
        predecessorCode: "99",
        successorCode: "B",
      }),
    );
  });
});
