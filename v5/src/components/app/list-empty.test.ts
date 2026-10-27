import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChangeOrderLinesEmpty,
  ChangeOrdersEmpty,
  ChangesFilterEmpty,
  ChangesNothingYet,
  CostEntriesEmpty,
  PlanHistoryEmpty,
  PlanLinesEmpty,
  type AppRole,
} from "./list-empty";

/**
 * verify-v5 flags a leaf whose text starts like "No … yet".
 * The skill is not edited here. Copy stays specific without that opener,
 * except the titled "No lines yet" line the crawl already allows on two cards.
 */
const CRAWL_EMPTY_OPENER =
  /^(no\s.{0,40}?\b(yet|found|to show|available)\b|nothing\s(here|yet|to show)\b|no data\b|0 jobs\b)/i;

const BANNED = [/lorem/i, /coming soon/i, /\bTODO\b/, /\bTBD\b/, /\bWIP\b/, /\bERP\b/, /placeholder/i];

function markup(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

function leaves(html: string): string[] {
  return [...html.matchAll(/<(?:p|a|button)[^>]*>([^<]*)<\//g)].map((m) =>
    m[1]!.replace(/\s+/g, " ").trim(),
  );
}

function assertCrawlSafe(html: string, allowNoLinesYet = false) {
  for (const text of leaves(html)) {
    if (allowNoLinesYet && /^No lines yet\b/.test(text)) continue;
    expect(text, text).not.toMatch(CRAWL_EMPTY_OPENER);
    for (const ban of BANNED) expect(text, text).not.toMatch(ban);
  }
}

const roles: AppRole[] = ["executive", "pm", "superintendent", "foreman"];

describe("change orders empty state", () => {
  it("offers New change order to a project manager on an approved job", () => {
    const html = markup(createElement(ChangeOrdersEmpty, {
      jobNumber: "24-077",
      canCreate: true,
      estimateApproved: true,
      onCreate: () => {},
    }));
    expect(html).toContain("No change orders on 24-077");
    expect(html).toContain("Log one when the owner or a sub raises a change.");
    expect(html).toContain("New change order");
    expect(html).toContain('data-testid="co-empty-create"');
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("Review the estimate");
    assertCrawlSafe(html);
  });

  it("hides New change order from the foreman", () => {
    const html = markup(createElement(ChangeOrdersEmpty, {
      jobNumber: "24-077",
      canCreate: false,
      estimateApproved: true,
    }));
    expect(html).toContain("A project manager logs one");
    expect(html).not.toContain("New change order");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
    assertCrawlSafe(html);
  });

  it("points a project manager at the estimate while the job is still a draft", () => {
    const html = markup(createElement(ChangeOrdersEmpty, {
      jobNumber: "26-010",
      canCreate: true,
      estimateApproved: false,
      onReviewEstimate: () => {},
    }));
    expect(html).toContain("No change orders on 26-010");
    const body =
      "Approve the estimate first, because Current Budget is set from the Current Estimate and a change order cannot be logged until then.";
    expect(leaves(html)).toContain(body);
    expect(body.split(/[.!?]/).filter((s) => s.trim())).toHaveLength(1);
    expect(html).toContain("Review the estimate");
    expect(html).not.toContain("New change order");
    assertCrawlSafe(html);
  });
});

describe("cost entries empty state", () => {
  it("gives the foreman Report day's work and withholds it from the executive", () => {
    const foreman = markup(createElement(CostEntriesEmpty, {
      role: "foreman",
      jobNumber: "25-031",
      code: "05-120",
    }));
    expect(foreman).toContain("No cost posted on 05-120");
    expect(foreman).toContain("superintendent approves a daily report");
    expect(foreman).toContain("Report day&#x27;s work");
    expect(foreman).toContain('href="/app/jobs/25-031"');
    expect(foreman).toContain("min-h-11");
    assertCrawlSafe(foreman);

    const executive = markup(createElement(CostEntriesEmpty, {
      role: "executive",
      jobNumber: "25-031",
      code: "05-120",
    }));
    expect(executive).toContain("No cost posted on 05-120");
    expect(executive).not.toContain("<a ");
    expect(executive).not.toContain("<button");
    assertCrawlSafe(executive);
  });

  it("gives the superintendent the daily plans link", () => {
    const html = markup(createElement(CostEntriesEmpty, {
      role: "superintendent",
      jobNumber: "25-031",
      code: "05-120",
    }));
    expect(html).toContain("Open daily plans");
    expect(html).toContain('href="/app/jobs/25-031"');
  });
});

describe("plan and change-log empty states", () => {
  it("lets only the superintendent add a line on a draft plan", () => {
    const superintendent = markup(createElement(PlanLinesEmpty, {
      role: "superintendent",
      status: "draft",
      jobNumber: "25-031",
    }));
    expect(superintendent).toContain("No activities on this plan");
    expect(superintendent).toContain("Add a line");
    expect(superintendent).toContain('href="/app/jobs/25-031"');
    assertCrawlSafe(superintendent);

    const foreman = markup(createElement(PlanLinesEmpty, {
      role: "foreman",
      status: "draft",
      jobNumber: "25-031",
    }));
    expect(foreman).toContain("superintendent adds a cost code");
    expect(foreman).not.toContain("Add a line");
    expect(foreman).not.toContain("<a ");
    assertCrawlSafe(foreman);
  });

  it("offers the foreman the job when a draft plan has no history", () => {
    const html = markup(createElement(PlanHistoryEmpty, {
      role: "foreman",
      status: "draft",
      jobNumber: "24-077",
    }));
    expect(html).toContain("No history recorded");
    expect(html).toContain("Open the plan on the job");
    const pm = markup(createElement(PlanHistoryEmpty, {
      role: "pm",
      status: "draft",
      jobNumber: "24-077",
    }));
    expect(pm).not.toContain("<a ");
    assertCrawlSafe(html);
    assertCrawlSafe(pm);
  });

  it("keeps No lines yet as its own line and prices only when that role can", () => {
    const pm = markup(createElement(ChangeOrderLinesEmpty, {
      status: "draft",
      canPrice: true,
      onPrice: () => {},
    }));
    expect(leaves(pm)).toContain("No lines yet");
    expect(pm).toContain("Price labor, material, equipment, and subcontract");
    expect(pm).toContain(">Price<");
    assertCrawlSafe(pm, true);

    const voided = markup(createElement(ChangeOrderLinesEmpty, {
      status: "voided",
      canPrice: false,
    }));
    expect(leaves(voided)).toContain("No lines yet");
    expect(voided).toContain("Current Budget did not move");
    expect(voided).not.toContain(">Price<");
    assertCrawlSafe(voided, true);
  });

  it("distinguishes nothing yet from a filter with no rows", () => {
    const none = markup(createElement(ChangesNothingYet, {
      role: "superintendent",
      jobNumber: "26-010",
      estimateApproved: false,
    }));
    expect(none).toContain("No changes on 26-010");
    expect(none).toContain("Open daily plans");
    expect(none).not.toContain("Clear filters");
    assertCrawlSafe(none);

    const filtered = markup(createElement(ChangesFilterEmpty, { onClear: () => {} }));
    expect(filtered).toContain("No changes match this filter");
    expect(filtered).toContain("Clear filters");
    expect(filtered).toContain("min-h-11");
    expect(filtered).not.toContain("New change order");
    assertCrawlSafe(filtered);
  });

  it("gives every role a next step on an empty change log", () => {
    for (const role of roles) {
      const html = markup(createElement(ChangesNothingYet, {
        role,
        jobNumber: "26-010",
        estimateApproved: false,
      }));
      expect(html).toContain('data-testid="changes-action"');
      if (role === "foreman") expect(html).toContain("Report day&#x27;s work");
      if (role === "pm" || role === "executive")
        expect(html).toContain("Review the estimate");
    }
  });
});
