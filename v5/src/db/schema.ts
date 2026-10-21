// v5 data model. Money is integer cents and quantities are integer thousandths ("milli"), never floats.
// Every tenant row carries company_id and cascades from companies, so deleting a sandbox removes all of it.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => bigint(name, { mode: "number" }).notNull();
const milli = (name: string) => bigint(name, { mode: "number" }).notNull();
const companyRef = () =>
  uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" });

export const roleEnum = pgEnum("role", [
  "executive",
  "pm",
  "superintendent",
  "foreman",
]);
/**
 * Daily plan lifecycle:
 * draft → issued (to the field) → reported (foreman actuals, pending) → approved (posts cost once).
 * Return from reported goes back to issued with a reason; values stay filled.
 */
export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "issued",
  "reported",
  "approved",
]);
/** How a cost item earns: units installed, weighted milestones, or a PM percent with a log. */
export const evMethodEnum = pgEnum("ev_method", [
  "units",
  "milestones",
  "pm_percent",
]);
export const claimStatusEnum = pgEnum("claim_status", ["draft", "locked"]);
export const costEntryKindEnum = pgEnum("cost_entry_kind", ["labor", "other"]);
/** Estimate lifecycle: draft until PM Approve freezes Original Budget. */
export const estimateStatusEnum = pgEnum("estimate_status", [
  "draft",
  "approved",
]);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    isSandbox: boolean("is_sandbox").notNull().default(true),
    seededAt: timestamp("seeded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** sha256 of the visitor cookie that created this sandbox, for the per-visitor cap. */
    visitorHash: text("visitor_hash"),
  },
  (t) => [index("companies_visitor_idx").on(t.visitorHash)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    role: roleEnum("role").notNull(),
  },
  (t) => [index("users_company_idx").on(t.companyId)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the random cookie token; the token itself is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: companyRef(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_company_idx").on(t.companyId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    number: text("number").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    owner: text("owner").notNull(),
    pmName: text("pm_name").notNull(),
    finishOn: date("finish_on").notNull(),
    contractCents: money("contract_cents"),
    /** draft until Approve freezes Original Budget; then approved. */
    estimateStatus: estimateStatusEnum("estimate_status")
      .notNull()
      .default("draft"),
  },
  (t) => [index("jobs_company_idx").on(t.companyId)],
);

export const costItems = pgTable(
  "cost_items",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /** Parent summary code; null = root. Leaves hold quantities and EV. */
    parentId: uuid("parent_id").references((): AnyPgColumn => costItems.id, {
      onDelete: "cascade",
    }),
    /** Materialized path, e.g. `/02/02-100/`, for prefix roll-ups and tree order. */
    path: text("path").notNull(),
    depth: integer("depth").notNull().default(0),
    /** False for WBS summary rows; roll-ups sum only leaves. */
    isLeaf: boolean("is_leaf").notNull().default(true),
    code: text("code").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    evMethod: evMethodEnum("ev_method").notNull().default("units"),
    budgetQtyMilli: milli("budget_qty_milli"),
    /** Live installed quantity from foreman daily reports (units method). Pending until PM lock. */
    installedQtyMilli: milli("installed_qty_milli"),
    /**
     * Installed quantity frozen on the last locked claim. Units EV uses this, not live installed.
     * Live qty above this is shown as pending until the next lock.
     */
    claimedInstalledQtyMilli: milli("claimed_installed_qty_milli").default(0),
    /**
     * Three value sets × four categories (labor/material/equipment/sub), integer cents.
     * Original Budget (ob_*) is frozen only by Approve. Current Budget (cb_*) starts
     * equal to OB and later moves with approved COs. Current Estimate (ce_*) is editable.
     * EV / portfolio / job KPIs read Current Budget (sum of cb_*).
     */
    obLaborCents: money("ob_labor_cents").default(0),
    obMaterialCents: money("ob_material_cents").default(0),
    obEquipmentCents: money("ob_equipment_cents").default(0),
    obSubCents: money("ob_sub_cents").default(0),
    cbLaborCents: money("cb_labor_cents").default(0),
    cbMaterialCents: money("cb_material_cents").default(0),
    cbEquipmentCents: money("cb_equipment_cents").default(0),
    cbSubCents: money("cb_sub_cents").default(0),
    ceLaborCents: money("ce_labor_cents").default(0),
    ceMaterialCents: money("ce_material_cents").default(0),
    ceEquipmentCents: money("ce_equipment_cents").default(0),
    ceSubCents: money("ce_sub_cents").default(0),
    /** Planned start/finish for linear time-phased PV. */
    plannedStartOn: date("planned_start_on").notNull(),
    plannedFinishOn: date("planned_finish_on").notNull(),
    /**
     * Denormalized planned value to date (from planned_start/finish).
     * Reads recompute as-of today; submit/lock also refresh the stored value.
     * Based on Current Budget total.
     */
    plannedCents: money("planned_cents"),
    /** Denormalized sum of cost_entries for this item. */
    actualCents: money("actual_cents"),
    /** Locked claim percent (thousandths). Display/snapshot; units earn from claimed qty. */
    claimedPercentMilli: milli("claimed_percent_milli").default(0),
    /** Human-readable how the locked percent was derived. */
    earnDerivation: text("earn_derivation").notNull().default(""),
    /** Budgeted man-hours per unit, in thousandths. */
    budgetMhPerUnitMilli: milli("budget_mh_per_unit_milli"),
  },
  (t) => [
    index("cost_items_job_idx").on(t.jobId),
    index("cost_items_job_path_idx").on(t.jobId, t.path),
    index("cost_items_job_parent_idx").on(t.jobId, t.parentId),
    index("cost_items_job_code_idx").on(t.jobId, t.code),
    index("cost_items_job_leaf_idx").on(t.jobId, t.isLeaf),
  ],
);

/** Weighted milestones for cost items that earn by milestone completion. */
export const costItemMilestones = pgTable(
  "cost_item_milestones",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Share of earnable percent, in thousandths (500 = 50%). Weights on one item sum to 1000. */
    weightMilli: milli("weight_milli"),
    complete: boolean("complete").notNull().default(false),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("cost_item_milestones_item_idx").on(t.costItemId)],
);

/** Actual cost rows: labor (hours × rate) and other costs. Source of AC. */
export const costEntries = pgTable(
  "cost_entries",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    kind: costEntryKindEnum("kind").notNull(),
    /** Man-hours in tenths, when kind = labor. */
    hoursTenths: integer("hours_tenths"),
    rateCents: integer("rate_cents"),
    amountCents: money("amount_cents"),
    note: text("note").notNull().default(""),
    /** Plan line that posted this labor row, when applicable. */
    sourcePlanLineId: uuid("source_plan_line_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cost_entries_item_idx").on(t.costItemId)],
);

/** Who/why log for PM percent-complete method. Latest entry is the working percent. */
export const pmPercentLogs = pgTable(
  "pm_percent_logs",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    percentMilli: milli("percent_milli"),
    reason: text("reason").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pm_percent_logs_item_idx").on(t.costItemId, t.at)],
);

/** Who/why audit when a weighted milestone is marked complete or reopened. */
export const milestoneLogs = pgTable(
  "milestone_logs",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => costItemMilestones.id, { onDelete: "cascade" }),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    complete: boolean("complete").notNull(),
    reason: text("reason").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("milestone_logs_item_idx").on(t.costItemId, t.at)],
);

/** Period progress claim. Locked claims drive earned value; billing comes after 5.0. */
export const progressClaims = pgTable(
  "progress_claims",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    periodLabel: text("period_label").notNull(),
    status: claimStatusEnum("status").notNull().default("draft"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedById: uuid("locked_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("progress_claims_job_idx").on(t.jobId)],
);

export const progressClaimLines = pgTable(
  "progress_claim_lines",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => progressClaims.id, { onDelete: "cascade" }),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    claimedPercentMilli: milli("claimed_percent_milli"),
    installedQtyMilli: milli("installed_qty_milli"),
    derivation: text("derivation").notNull().default(""),
  },
  (t) => [index("progress_claim_lines_claim_idx").on(t.claimId)],
);

export const dailyPlans = pgTable(
  "daily_plans",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    crew: text("crew").notNull(),
    foremanId: uuid("foreman_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planDate: date("plan_date").notNull(),
    status: planStatusEnum("status").notNull().default("draft"),
    weather: text("weather").notNull(),
    equipment: jsonb("equipment")
      .$type<{ name: string; hours: number }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** When the plan was issued to the field (legacy column name: submitted_at). */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** Superintendent return reason; cleared on the next report. */
    returnReason: text("return_reason"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedById: uuid("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("daily_plans_company_idx").on(t.companyId)],
);

export const dailyPlanLines = pgTable(
  "daily_plan_lines",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => dailyPlans.id, { onDelete: "cascade" }),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    activity: text("activity").notNull(),
    location: text("location").notNull(),
    qtyMilli: milli("qty_milli"),
    workers: integer("workers").notNull(),
    hoursTenths: integer("hours_tenths").notNull(),
    notes: text("notes").notNull().default(""),
    sort: integer("sort").notNull(),
    /**
     * Foreman-reported quantity (milli). Null until first report.
     * Pending until superintendent approve — does not touch installed/actual cost.
     */
    reportedQtyMilli: bigint("reported_qty_milli", { mode: "number" }),
    /** Foreman-reported man-hours in tenths. Null until first report. */
    reportedHoursTenths: integer("reported_hours_tenths"),
  },
  (t) => [index("daily_plan_lines_plan_idx").on(t.planId)],
);

/** Every typed action the assistant ran, so the rail can show its work. */
export const actionRuns = pgTable(
  "action_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: companyRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    action: text("action").notNull(),
    args: jsonb("args").notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("action_runs_company_idx").on(t.companyId, t.createdAt)],
);

/** Deploy-wide key/value (not sandbox-scoped): last verify stamp, etc. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
