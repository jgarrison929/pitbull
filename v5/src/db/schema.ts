// v5 data model. Money is integer cents and quantities are integer thousandths ("milli"), never floats.
// Every tenant row carries company_id and cascades from companies, so deleting a sandbox removes all of it.
import { sql } from "drizzle-orm";
import {
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
export const planStatusEnum = pgEnum("plan_status", ["draft", "submitted"]);

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
    code: text("code").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    budgetQtyMilli: milli("budget_qty_milli"),
    installedQtyMilli: milli("installed_qty_milli"),
    budgetCents: money("budget_cents"),
    /** Planned value to date. Linear until the schedule module lands (5.1). */
    plannedCents: money("planned_cents"),
    actualCents: money("actual_cents"),
    /** Budgeted man-hours per unit, in thousandths. */
    budgetMhPerUnitMilli: milli("budget_mh_per_unit_milli"),
  },
  (t) => [index("cost_items_job_idx").on(t.jobId)],
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
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
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
    sort: integer("sort").notNull(),
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
