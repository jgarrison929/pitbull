import { NextResponse } from "next/server";
import { searchCostItems } from "@/server/cost-rollups";
import { resolveJobId } from "@/server/data";
import { requireUser } from "@/server/session";

/** Server-side cost-code typeahead for plan-line comboboxes. Leaves only. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ number: string }> },
) {
  const user = await requireUser();
  const { number } = await ctx.params;
  // Resolve id only — never getJob() (that loads every cost item per keystroke).
  const jobId = await resolveJobId(user.companyId, number);
  if (!jobId)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20),
  );
  const started = performance.now();
  const rows = await searchCostItems(user.companyId, jobId, q, limit);
  const ms = performance.now() - started;
  return NextResponse.json({
    items: rows.map((r) => ({
      value: r.id,
      label: `${r.code} ${r.description}`,
      hint: r.unit,
      unit: r.unit,
    })),
    ms: Math.round(ms * 100) / 100,
  });
}
