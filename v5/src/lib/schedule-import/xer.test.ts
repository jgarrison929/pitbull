import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_SCHEDULE_IMPORT_BYTES } from "./types";
import { parseXer } from "./xer";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../fixtures/schedule/${name}`, import.meta.url));

describe("parseXer", () => {
  it("parses cedar-ok activities, FS/SS links, holidays, and skipped kinds", () => {
    const draft = parseXer(fixture("cedar-ok.xer"));
    expect("error" in draft).toBe(false);
    if ("error" in draft) return;

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
    expect(draft.activities.find((a) => a.code === "C")).toMatchObject({
      durationDays: 4,
    });

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

    const byKind = Object.fromEntries(
      draft.skipped.map((s) => [s.kind, s]),
    );
    expect(byKind.constraint).toMatchObject({ count: 1, sample: "C:CS_MSO" });
    expect(byKind.milestone).toMatchObject({ count: 1 });
    expect(byKind.unsupported_link_type).toMatchObject({ count: 1 });
  });

  it("keeps a missing predecessor id so apply can name the gap", () => {
    const draft = parseXer(fixture("cedar-missing-pred.xer"));
    expect("error" in draft).toBe(false);
    if ("error" in draft) return;
    expect(draft.links).toEqual(
      expect.arrayContaining([
        {
          predecessorCode: "999",
          successorCode: "D",
          type: "finish_to_start",
          lagDays: 0,
        },
      ]),
    );
  });

  it("counts skipped constraint rows without failing the draft", () => {
    const xer = [
      "ERMHDR\tXER",
      "%T\tTASK",
      "%F\ttask_id\ttask_code\ttask_name\ttask_type\tcstr_type\ttarget_drtn_hr_cnt",
      "%R\t1\tA\tOne\tTT_Task\tCS_MEO\t8",
      "%R\t2\tB\tTwo\tTT_Task\tCS_ASAP\t8",
      "%E",
      "",
    ].join("\n");
    const draft = parseXer(new TextEncoder().encode(xer));
    expect("error" in draft).toBe(false);
    if ("error" in draft) return;
    expect(draft.activities).toHaveLength(2);
    expect(draft.skipped).toEqual([
      { kind: "constraint", count: 1, sample: "A:CS_MEO" },
    ]);
  });

  it("refuses files over 10 MB before parse", () => {
    const over = new Uint8Array(MAX_SCHEDULE_IMPORT_BYTES + 1);
    const r = parseXer(over);
    expect(r).toEqual({
      error:
        "Schedule file is over 10 MB and was refused before parse.",
    });
  });

  it("refuses an empty XER", () => {
    const r = parseXer(new TextEncoder().encode("ERMHDR\tonly\n"));
    expect(r).toEqual({ error: "XER file has no tables." });
  });
});
