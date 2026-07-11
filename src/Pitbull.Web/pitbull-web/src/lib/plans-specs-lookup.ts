/**
 * Pure search/filter for plan sets and spec sections (mobile plans-specs viewer).
 */

export interface PlanSetSearchItem {
  id: string;
  name: string;
  discipline: string;
  revision: string;
  status: string;
  issueDate?: string;
  description?: string;
  /** Optional document / sheet URL for preview */
  documentUrl?: string;
  sheetNumber?: string;
}

export interface SpecSectionSearchItem {
  id: string;
  sectionCode: string;
  title: string;
  divisionCode: string;
  status: string;
  description?: string;
}

export function filterPlanSets(
  items: PlanSetSearchItem[],
  query: string
): PlanSetSearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => {
    const hay = [
      item.name,
      item.discipline,
      item.revision,
      item.status,
      item.sheetNumber,
      item.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function filterSpecSections(
  items: SpecSectionSearchItem[],
  query: string
): SpecSectionSearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => {
    const hay = [
      item.sectionCode,
      item.title,
      item.divisionCode,
      item.status,
      item.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Prefer Issued/Current; then match id from deep link. */
export function selectPlanOrSpecFromDeepLink(
  planSets: PlanSetSearchItem[],
  specs: SpecSectionSearchItem[],
  opts: { planId?: string; sheet?: string; section?: string }
): {
  plan: PlanSetSearchItem | null;
  spec: SpecSectionSearchItem | null;
} {
  let plan: PlanSetSearchItem | null = null;
  let spec: SpecSectionSearchItem | null = null;

  if (opts.planId) {
    plan = planSets.find((p) => p.id === opts.planId) ?? null;
  } else if (opts.sheet) {
    const s = opts.sheet.toLowerCase();
    plan =
      planSets.find(
        (p) =>
          p.sheetNumber?.toLowerCase() === s ||
          p.name.toLowerCase().includes(s)
      ) ?? null;
  }

  if (opts.section) {
    const sec = opts.section.toLowerCase();
    spec =
      specs.find(
        (sp) =>
          sp.sectionCode.toLowerCase() === sec ||
          sp.sectionCode.toLowerCase().includes(sec) ||
          sp.title.toLowerCase().includes(sec)
      ) ?? null;
  }

  return { plan, spec };
}

/** Build deep-link path for plans-specs from daily report / site walk. */
export function buildPlansSpecsHref(
  projectId: string,
  opts?: { planId?: string; sheet?: string; section?: string; view?: "plans" | "specs" }
): string {
  const params = new URLSearchParams();
  if (opts?.planId) params.set("planId", opts.planId);
  if (opts?.sheet) params.set("sheet", opts.sheet);
  if (opts?.section) params.set("section", opts.section);
  if (opts?.view) params.set("view", opts.view);
  const qs = params.toString();
  return `/projects/${projectId}/plans-specs${qs ? `?${qs}` : ""}`;
}
