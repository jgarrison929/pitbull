// Original / Current Budget / Current Estimate — integer cents only.
// Each value set splits into labor, material, equipment, and sub.
// Approve is the only writer of Original Budget; Current Budget starts equal to it.

export type CostCategories = {
  laborCents: number;
  materialCents: number;
  equipmentCents: number;
  subCents: number;
};

export type ValueSet = "ob" | "cb" | "ce";

/** Sum of the four cost categories (integer cents). */
export function categoryTotal(c: CostCategories): number {
  return c.laborCents + c.materialCents + c.equipmentCents + c.subCents;
}

/** Current Budget total — EV, portfolio, and job KPIs read this. */
export function currentBudgetCents(row: {
  cbLaborCents: number;
  cbMaterialCents: number;
  cbEquipmentCents: number;
  cbSubCents: number;
}): number {
  return categoryTotal({
    laborCents: row.cbLaborCents,
    materialCents: row.cbMaterialCents,
    equipmentCents: row.cbEquipmentCents,
    subCents: row.cbSubCents,
  });
}

/** Current Estimate total — working sandbox before/after approval. */
export function currentEstimateCents(row: {
  ceLaborCents: number;
  ceMaterialCents: number;
  ceEquipmentCents: number;
  ceSubCents: number;
}): number {
  return categoryTotal({
    laborCents: row.ceLaborCents,
    materialCents: row.ceMaterialCents,
    equipmentCents: row.ceEquipmentCents,
    subCents: row.ceSubCents,
  });
}

/** Original Budget total — frozen snapshot; never edited after Approve. */
export function originalBudgetCents(row: {
  obLaborCents: number;
  obMaterialCents: number;
  obEquipmentCents: number;
  obSubCents: number;
}): number {
  return categoryTotal({
    laborCents: row.obLaborCents,
    materialCents: row.obMaterialCents,
    equipmentCents: row.obEquipmentCents,
    subCents: row.obSubCents,
  });
}

export function ceCategories(row: {
  ceLaborCents: number;
  ceMaterialCents: number;
  ceEquipmentCents: number;
  ceSubCents: number;
}): CostCategories {
  return {
    laborCents: row.ceLaborCents,
    materialCents: row.ceMaterialCents,
    equipmentCents: row.ceEquipmentCents,
    subCents: row.ceSubCents,
  };
}

/**
 * Column payload for a cost item's three value sets.
 * draft: CE = cats, OB/CB = 0. approved: OB = CB = CE = cats.
 */
export function valueSetColumns(
  cats: CostCategories,
  mode: "draft" | "approved",
) {
  const frozen = mode === "approved" ? cats : emptyCategories();
  return {
    obLaborCents: frozen.laborCents,
    obMaterialCents: frozen.materialCents,
    obEquipmentCents: frozen.equipmentCents,
    obSubCents: frozen.subCents,
    cbLaborCents: frozen.laborCents,
    cbMaterialCents: frozen.materialCents,
    cbEquipmentCents: frozen.equipmentCents,
    cbSubCents: frozen.subCents,
    ceLaborCents: cats.laborCents,
    ceMaterialCents: cats.materialCents,
    ceEquipmentCents: cats.equipmentCents,
    ceSubCents: cats.subCents,
  };
}

/** Current Estimate columns only. Revising a draft item never touches Original or Current Budget. */
export function ceOnlyColumns(cats: CostCategories) {
  return {
    ceLaborCents: cats.laborCents,
    ceMaterialCents: cats.materialCents,
    ceEquipmentCents: cats.equipmentCents,
    ceSubCents: cats.subCents,
  };
}

/**
 * Round half away from zero to integer cents.
 * 1.665 → 2; −1.665 → −2. Never use Math.round (banker's / half-up toward +∞ quirks).
 */
export function roundHalfAwayFromZero(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n >= 0) return Math.floor(n + 0.5);
  return Math.ceil(n - 0.5);
}

/**
 * Category cost from quantity (milli) × unit cost (cents per unit).
 * qtyMilli 333 (0.333) × unitCents 5 ($0.05) → 1.665 → 2 cents.
 */
export function categoryCostCents(qtyMilli: number, unitCents: number): number {
  if (qtyMilli === 0 || unitCents === 0) return 0;
  return roundHalfAwayFromZero((qtyMilli * unitCents) / 1000);
}

/** Man-hours (milli) from qty × MH per unit (both milli). Result in milli-hours. */
export function manHoursMilli(
  qtyMilli: number,
  mhPerUnitMilli: number,
): number {
  if (qtyMilli === 0 || mhPerUnitMilli === 0) return 0;
  return roundHalfAwayFromZero((qtyMilli * mhPerUnitMilli) / 1000);
}

export function emptyCategories(): CostCategories {
  return { laborCents: 0, materialCents: 0, equipmentCents: 0, subCents: 0 };
}

/**
 * Lump seed jobs only (estimate_source = seed): the whole total lands in labor, so the split is not real.
 * CSV estimates and the Harbor seed never call this.
 */
export function plugLabor(totalCents: number): CostCategories {
  return {
    laborCents: totalCents,
    materialCents: 0,
    equipmentCents: 0,
    subCents: 0,
  };
}

export function categoriesFromUnitCosts(
  qtyMilli: number,
  units: {
    laborCents: number;
    materialCents: number;
    equipmentCents: number;
    subCents: number;
  },
): CostCategories {
  return {
    laborCents: categoryCostCents(qtyMilli, units.laborCents),
    materialCents: categoryCostCents(qtyMilli, units.materialCents),
    equipmentCents: categoryCostCents(qtyMilli, units.equipmentCents),
    subCents: categoryCostCents(qtyMilli, units.subCents),
  };
}

/**
 * Approve freezes Original Budget from Current Estimate and sets Current Budget = OB.
 * Refuses when the estimate total and the budget that would be written differ by even one cent.
 */
export function approveTotalsGuard(
  estimateTotalCents: number,
  budgetTotalCents: number,
): { ok: true } | { ok: false; estimateTotalCents: number; budgetTotalCents: number } {
  if (estimateTotalCents !== budgetTotalCents) {
    return { ok: false, estimateTotalCents, budgetTotalCents };
  }
  return { ok: true };
}

/** Money for one WBS node. Summaries and the job total sum their leaves. */
export type WbsMoney = {
  obCents: number;
  cbCents: number;
  ceCents: number;
  ce: CostCategories;
  mhMilli: number;
  /** Null on summaries and the job total: quantities in different units do not add. */
  qtyMilli: number | null;
};

type WbsMoneyRow = {
  id: string;
  path: string;
  isLeaf: boolean;
  budgetQtyMilli: number;
  budgetMhPerUnitMilli: number;
  obLaborCents: number;
  obMaterialCents: number;
  obEquipmentCents: number;
  obSubCents: number;
  cbLaborCents: number;
  cbMaterialCents: number;
  cbEquipmentCents: number;
  cbSubCents: number;
  ceLaborCents: number;
  ceMaterialCents: number;
  ceEquipmentCents: number;
  ceSubCents: number;
};

/**
 * Original, Current, and Estimate money plus man-hours per node, rolled up by path prefix like the SQL
 * roll-ups. Only leaves count; stored summary money is ignored. Parent MH is the sum of qty × rate
 * on its leaves, never a sum of rates.
 */
export function buildWbsMoney(rows: readonly WbsMoneyRow[]): {
  byId: Record<string, WbsMoney>;
  job: WbsMoney;
} {
  const zero = (qtyMilli: number | null): WbsMoney => ({
    obCents: 0,
    cbCents: 0,
    ceCents: 0,
    ce: emptyCategories(),
    mhMilli: 0,
    qtyMilli,
  });
  const byId: Record<string, WbsMoney> = {};
  const byPath = new Map<string, WbsMoney>();
  for (const r of rows) {
    byId[r.id] = zero(r.isLeaf ? r.budgetQtyMilli : null);
    byPath.set(r.path, byId[r.id]);
  }
  const job = zero(null);
  for (const r of rows) {
    if (!r.isLeaf) continue;
    const ob = originalBudgetCents(r);
    const cb = currentBudgetCents(r);
    const ce = ceCategories(r);
    const mhMilli = manHoursMilli(r.budgetQtyMilli, r.budgetMhPerUnitMilli);
    const add = (m: WbsMoney) => {
      m.obCents += ob;
      m.cbCents += cb;
      m.ceCents += categoryTotal(ce);
      m.ce.laborCents += ce.laborCents;
      m.ce.materialCents += ce.materialCents;
      m.ce.equipmentCents += ce.equipmentCents;
      m.ce.subCents += ce.subCents;
      m.mhMilli += mhMilli;
    };
    for (let i = r.path.indexOf("/", 1); i !== -1; i = r.path.indexOf("/", i + 1)) {
      const node = byPath.get(r.path.slice(0, i + 1));
      if (node) add(node);
    }
    add(job);
  }
  return { byId, job };
}

/** The SHB-1001 estimate CSV from docs/v5/intel/estimate-to-budget.md (invented example data). */
export const SHB_CSV = `code,parent_code,description,unit,qty,mh_per_unit,labor_unit,material_unit,equipment_unit,sub_unit
02,,Earthwork,,,,,,,
02-100,02,Excavation,CY,1200,0.05,4.50,0,6.25,0
02-200,02,Structural backfill,CY,800,0.08,5.00,18.00,3.50,0
03,,Concrete,,,,,,,
03-100,03,Footing concrete,CY,150,1.2,72.00,165.00,0,0
03-200,03,Rebar install (sub),LB,18000,0,0,0,0,0.95
`;

/** Hand-computed SHB-1001 leaf fixture from docs/v5/intel/estimate-to-budget.md. */
export const SHB_FIXTURE = {
  jobTotalCents: 8_675_000,
  jobMhMilli: 304_000,
  categories: {
    laborCents: 2_020_000,
    materialCents: 3_915_000,
    equipmentCents: 1_030_000,
    subCents: 1_710_000,
  },
  leaves: [
    {
      code: "02-100",
      description: "Excavation",
      unit: "CY",
      qtyMilli: 1_200_000,
      mhPerUnitMilli: 50,
      units: { laborCents: 450, materialCents: 0, equipmentCents: 625, subCents: 0 },
      // qty×unit: 1200×4.50=5400, 1200×6.25=7500 → total 12900
      expected: {
        laborCents: 540_000,
        materialCents: 0,
        equipmentCents: 750_000,
        subCents: 0,
        totalCents: 1_290_000,
        mhMilli: 60_000,
      },
    },
    {
      code: "02-200",
      description: "Structural backfill",
      unit: "CY",
      qtyMilli: 800_000,
      mhPerUnitMilli: 80,
      units: {
        laborCents: 500,
        materialCents: 1_800,
        equipmentCents: 350,
        subCents: 0,
      },
      expected: {
        laborCents: 400_000,
        materialCents: 1_440_000,
        equipmentCents: 280_000,
        subCents: 0,
        totalCents: 2_120_000,
        mhMilli: 64_000,
      },
    },
    {
      code: "03-100",
      description: "Footing concrete",
      unit: "CY",
      qtyMilli: 150_000,
      mhPerUnitMilli: 1_200,
      units: {
        laborCents: 7_200,
        materialCents: 16_500,
        equipmentCents: 0,
        subCents: 0,
      },
      expected: {
        laborCents: 1_080_000,
        materialCents: 2_475_000,
        equipmentCents: 0,
        subCents: 0,
        totalCents: 3_555_000,
        mhMilli: 180_000,
      },
    },
    {
      code: "03-200",
      description: "Rebar install (sub)",
      unit: "LB",
      qtyMilli: 18_000_000,
      mhPerUnitMilli: 0,
      units: { laborCents: 0, materialCents: 0, equipmentCents: 0, subCents: 95 },
      expected: {
        laborCents: 0,
        materialCents: 0,
        equipmentCents: 0,
        subCents: 1_710_000,
        totalCents: 1_710_000,
        mhMilli: 0,
      },
    },
  ],
} as const;

/** Rounding case: qty 0.333 × labor $0.05 → 2 cents (1.665 half away from zero). */
export const ROUNDING_FIXTURE = {
  qtyMilli: 333,
  laborUnitCents: 5,
  expectedLaborCents: 2,
} as const;
