import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies } from "@/db/schema";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { seedId } from "@/seed";
import { laborRateForPlan, listCrews } from "@/server/plans";
import { createSandbox } from "@/server/sandbox";

const db = getDb();
const created: string[] = [];

describe.skipIf(!db)("laborRateForPlan / listCrews", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("reads each seed crew's labor rate", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    const crews = await listCrews(companyId);
    expect(crews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Bridge Crew 2",
          laborRateCents: CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
        }),
        expect.objectContaining({
          name: "Culvert Crew A",
          laborRateCents: CREW_LABOR_RATE_CENTS["Culvert Crew A"],
        }),
        expect.objectContaining({
          name: "Interchange Crew 1",
          laborRateCents: CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
        }),
      ]),
    );

    const cedarPlan = seedId(companyId, "plan:cedar:tomorrow");
    const i5Plan = seedId(companyId, "plan:i5:today");
    expect(await laborRateForPlan(requireDb(), cedarPlan)).toBe(
      CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
    );
    expect(await laborRateForPlan(requireDb(), i5Plan)).toBe(
      CREW_LABOR_RATE_CENTS["Culvert Crew A"],
    );
  });
});
