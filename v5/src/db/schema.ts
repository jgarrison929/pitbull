// v5 data model. Money is integer cents and quantities are integer thousandths ("milli"), never floats.
// Every tenant row carries company_id and cascades from companies, so deleting a sandbox removes all of it.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
/** Per-item EAC method. Current Budget or Average Performance (selectable per leaf). */
export const forecastMethodEnum = pgEnum("forecast_method", [
  "current_budget",
  "average_performance",
]);
export const claimStatusEnum = pgEnum("claim_status", ["draft", "locked"]);
export const costEntryKindEnum = pgEnum("cost_entry_kind", ["labor", "other"]);
/** Estimate lifecycle: draft until PM Approve freezes Original Budget. */
export const estimateStatusEnum = pgEnum("estimate_status", [
  "draft",
  "approved",
]);
/** Change-order lifecycle. Legal moves live in CO_TRANSITIONS (lib/change-order.ts). */
export const coStatusEnum = pgEnum("co_status", [
  "draft",
  "priced",
  "approved",
  "rejected",
  "voided",
]);
/** Commands that move a change order. One change_order_events row per accepted command. */
export const coCommandEnum = pgEnum("co_command", [
  "create",
  "price",
  "approve",
  "reject",
  "void",
]);
/**
 * seed: a lump total plugged into labor (no real category split).
 * csv: a unit-cost estimate with labor/material/equipment/sub from the CSV grammar.
 */
export const estimateSourceEnum = pgEnum("estimate_source", ["seed", "csv"]);
/** Append-only daily plan lifecycle events (submit / report / return / approve). */
export const planEventKindEnum = pgEnum("plan_event_kind", [
  "created",
  "submitted",
  "reported",
  "returned",
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
    estimateSource: estimateSourceEnum("estimate_source")
      .notNull()
      .default("seed"),
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
    forecastMethod: forecastMethodEnum("forecast_method")
      .notNull()
      .default("current_budget"),
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
    /** Denormalized sum of cost_entries for this item (live). */
    actualCents: money("actual_cents"),
    /**
     * Actual cost frozen on the last locked claim. EV indices (CPI) and forecasts
     * read this; live actualCents − lockedActualCents is the "since lock" delta.
     */
    lockedActualCents: money("locked_actual_cents").default(0),
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
    // CSV import upserts by cost code, so a code appears once per job.
    uniqueIndex("cost_items_job_code_uidx").on(t.jobId, t.code),
    index("cost_items_job_leaf_idx").on(t.jobId, t.isLeaf),
    index("cost_items_parent_idx").on(t.parentId),
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
    /**
     * Set when a progress-claim lock freezes this row into locked actual.
     * Null means posted after the latest lock snapshot (pending). Not the
     * plan/calendar date in `at`.
     */
    lockedInAt: timestamp("locked_in_at", { withTimezone: true }),
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
  (t) => [
    index("progress_claim_lines_claim_idx").on(t.claimId),
    index("progress_claim_lines_item_idx").on(t.costItemId),
  ],
);

/**
 * Named field crew with a foreman. Plans point here so labor rates (5.0.2)
 * and the crew picker share one list.
 */
export const crews = pgTable(
  "crews",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    name: text("name").notNull(),
    foremanId: uuid("foreman_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Blended crew labor rate (cents per MH). Snapshot onto cost_entries at
     * approve. DB DEFAULT keeps pre-0014 writers working (expand-only).
     */
    laborRateCents: integer("labor_rate_cents").notNull().default(8500),
  },
  (t) => [uniqueIndex("crews_company_name_uidx").on(t.companyId, t.name)],
);

export const dailyPlans = pgTable(
  "daily_plans",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /**
     * Required after 0019 crews contract. Migration backfills nulls from the
     * legacy text column, then drops that column.
     */
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, {
        onDelete: "restrict",
      }),
    foremanId: uuid("foreman_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planDate: date("plan_date").notNull(),
    status: planStatusEnum("status").notNull().default("draft"),
    /** Optional; empty string hides the weather row on the plan card. */
    weather: text("weather").notNull().default(""),
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
    /** Insert time — used for duplicate-plan "newest" tie-break (before id). */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Who created the plan (live createDailyPlan sets the actor). */
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** When the foreman last reported actuals on this plan. */
    reportedAt: timestamp("reported_at", { withTimezone: true }),
  },
  (t) => [
    index("daily_plans_company_idx").on(t.companyId),
    uniqueIndex("daily_plans_job_crew_date_uidx").on(
      t.jobId,
      t.crewId,
      t.planDate,
    ),
  ],
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
  (t) => [
    index("daily_plan_lines_plan_idx").on(t.planId),
    index("daily_plan_lines_item_idx").on(t.costItemId),
  ],
);

/**
 * Append-only plan lifecycle log. Stamp columns on daily_plans keep the *last*
 * of each kind; this table keeps every submit / return / approve with role + time.
 * Writers update the stamp and insert an event in the same transaction.
 */
export const dailyPlanEvents = pgTable(
  "daily_plan_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: companyRef(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => dailyPlans.id, { onDelete: "cascade" }),
    kind: planEventKindEnum("kind").notNull(),
    /** Role at the time of the command. Shown in the UI — never a display name. */
    actorRole: roleEnum("actor_role").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Return reason, or empty. */
    detail: text("detail").notNull().default(""),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("daily_plan_events_plan_idx").on(t.planId, t.at)],
);

/**
 * A change order revises a job's Current Budget after its estimate is approved.
 * Original Budget never moves. Only server/change-orders.ts writes these three tables.
 */
export const changeOrders = pgTable(
  "change_orders",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /** Per-job sequence shown as CO-001. Allocated under the job row lock. */
    number: integer("number").notNull(),
    title: text("title").notNull(),
    /** Why the change exists (owner directive, design change, field condition). */
    reason: text("reason").notNull().default(""),
    status: coStatusEnum("status").notNull().default("draft"),
    /** +1 on every price that changes lines. Screen approve names the revision it showed. */
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("change_orders_job_number_uq").on(t.jobId, t.number),
    index("change_orders_job_status_idx").on(t.jobId, t.status),
  ],
);

/**
 * One row per existing cost item a CO revises, or per new cost item it adds. Signed integer cents.
 * Existing-item line: cost_item_id set, new_* null.
 * New-item line: new_* set; cost_item_id is filled at approve with the leaf it created.
 */
export const changeOrderLines = pgTable(
  "change_order_lines",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    changeOrderId: uuid("change_order_id")
      .notNull()
      .references(() => changeOrders.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull(),
    costItemId: uuid("cost_item_id").references(() => costItems.id, {
      onDelete: "cascade",
    }),
    newCode: text("new_code"),
    newDescription: text("new_description"),
    newUnit: text("new_unit"),
    /** Summary row the new leaf goes under; null = root. */
    newParentId: uuid("new_parent_id").references(() => costItems.id, {
      onDelete: "cascade",
    }),
    laborCents: money("labor_cents").default(0),
    materialCents: money("material_cents").default(0),
    equipmentCents: money("equipment_cents").default(0),
    subCents: money("sub_cents").default(0),
    /** Signed budget-quantity delta. Scope added at the same unit rate keeps EV, so EAC moves by Δ. */
    qtyDeltaMilli: milli("qty_delta_milli").default(0),
    note: text("note").notNull().default(""),
  },
  (t) => [
    index("change_order_lines_co_idx").on(t.changeOrderId),
    index("change_order_lines_item_idx").on(t.costItemId),
    /** One line per existing item per CO keeps CB − OB = Σ approved lines a plain sum. */
    uniqueIndex("change_order_lines_co_item_uq")
      .on(t.changeOrderId, t.costItemId)
      .where(sql`${t.newCode} is null`),
    uniqueIndex("change_order_lines_co_code_uq")
      .on(t.changeOrderId, t.newCode)
      .where(sql`${t.newCode} is not null`),
    check(
      "change_order_lines_target_ck",
      sql`${t.costItemId} is not null or (${t.newCode} is not null and ${t.newDescription} is not null and ${t.newUnit} is not null)`,
    ),
  ],
);

/** Append-only transition log, written in the same transaction as the state change and budget move. */
export const changeOrderEvents = pgTable(
  "change_order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: companyRef(),
    changeOrderId: uuid("change_order_id")
      .notNull()
      .references(() => changeOrders.id, { onDelete: "cascade" }),
    command: coCommandEnum("command").notNull(),
    /** Null only for create. */
    fromStatus: coStatusEnum("from_status"),
    toStatus: coStatusEnum("to_status").notNull(),
    revision: integer("revision").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Role at the time of the command. */
    actorRole: roleEnum("actor_role").notNull(),
    reason: text("reason").notNull().default(""),
    /** CO total (Σ line cents) at this event. */
    totalCents: money("total_cents"),
    /** Approve only: the exact job CB and EAC moves this transaction wrote. */
    cbDeltaCents: bigint("cb_delta_cents", { mode: "number" }),
    eacDeltaCents: bigint("eac_delta_cents", { mode: "number" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("change_order_events_co_idx").on(t.changeOrderId, t.at),
    /** One decision per CO even if a status check were bypassed. Lists TERMINAL_STATUSES (pinned by test). */
    uniqueIndex("change_order_events_decision_uq")
      .on(t.changeOrderId)
      .where(sql`${t.toStatus} in ('approved', 'rejected', 'voided')`),
  ],
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

// --- 5.1.0-a schedule (migration 0020). Types also exported from @/lib/schedule. ---

/** One working calendar per job. Holidays are dates with no work. */
export const jobCalendars = pgTable(
  "job_calendars",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Bitmask: bit 0 = Monday … bit 6 = Sunday. Default Mon–Fri = 31. */
    workdaysMask: integer("workdays_mask").notNull().default(31),
  },
  (t) => [uniqueIndex("job_calendars_job_uidx").on(t.jobId)],
);

export const calendarHolidays = pgTable(
  "calendar_holidays",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => jobCalendars.id, { onDelete: "cascade" }),
    on: date("on").notNull(),
    name: text("name").notNull().default(""),
  },
  (t) => [uniqueIndex("calendar_holidays_day_uidx").on(t.calendarId, t.on)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey(),
    companyId: companyRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Whole working days. */
    durationDays: integer("duration_days").notNull(),
    /** Optional "start no earlier than" constraint (used by 5.1.1). */
    startNoEarlierOn: date("start_no_earlier_on"),
    earlyStartOn: date("early_start_on").notNull(),
    earlyFinishOn: date("early_finish_on").notNull(),
    lateStartOn: date("late_start_on").notNull(),
    lateFinishOn: date("late_finish_on").notNull(),
    totalFloatDays: integer("total_float_days").notNull().default(0),
    isCritical: boolean("is_critical").notNull().default(false),
    /** Bumped on every write. A save with a stale version is refused (I8). */
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("activities_job_code_uidx").on(t.jobId, t.code),
    index("activities_job_idx").on(t.jobId),
    check(
      "activities_duration_days_ck",
      sql`${t.durationDays} >= 1 and ${t.durationDays} <= 3650`,
    ),
  ],
);

/** Many activities ↔ many leaf cost items. */
export const activityCostItems = pgTable(
  "activity_cost_items",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id, { onDelete: "cascade" }),
    companyId: companyRef(),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.costItemId] }),
    index("activity_cost_items_item_idx").on(t.costItemId),
  ],
);
