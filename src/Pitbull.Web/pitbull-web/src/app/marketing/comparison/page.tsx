"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Minus, ChevronDown, HardHat } from "lucide-react";

// --- Data Types ---

type Support = "yes" | "no" | "partial";

interface FeatureRow {
  feature: string;
  pitbull: Support;
  procore: Support;
  vista: Support;
  sage: Support;
  foundation: Support;
  hcss: Support;
}

interface AiFeatureRow {
  feature: string;
  pitbull: Support;
  others: Support;
}

interface CategorySection {
  title: string;
  rows: FeatureRow[];
}

interface AiCategorySection {
  title: string;
  rows: AiFeatureRow[];
}

// --- Competitor keys ---

const competitors = [
  { key: "procore" as const, label: "Procore" },
  { key: "vista" as const, label: "Vista" },
  { key: "sage" as const, label: "Sage 300" },
  { key: "foundation" as const, label: "Foundation" },
  { key: "hcss" as const, label: "HCSS" },
];

// --- Feature Data ---

const coreModules: CategorySection = {
  title: "Core Modules",
  rows: [
    { feature: "Project Management", pitbull: "yes", procore: "yes", vista: "yes", sage: "yes", foundation: "partial", hcss: "yes" },
    { feature: "Estimating & Bidding", pitbull: "yes", procore: "partial", vista: "yes", sage: "yes", foundation: "yes", hcss: "yes" },
    { feature: "Contracts & Change Orders", pitbull: "yes", procore: "yes", vista: "yes", sage: "yes", foundation: "yes", hcss: "no" },
    { feature: "AP/AR & Billing", pitbull: "yes", procore: "no", vista: "yes", sage: "yes", foundation: "yes", hcss: "no" },
    { feature: "General Ledger", pitbull: "yes", procore: "no", vista: "yes", sage: "yes", foundation: "yes", hcss: "no" },
    { feature: "Job Costing", pitbull: "yes", procore: "partial", vista: "yes", sage: "yes", foundation: "yes", hcss: "yes" },
    { feature: "Equipment Tracking", pitbull: "yes", procore: "no", vista: "yes", sage: "partial", foundation: "no", hcss: "yes" },
    { feature: "Time Tracking", pitbull: "yes", procore: "yes", vista: "yes", sage: "yes", foundation: "yes", hcss: "yes" },
    { feature: "Payroll & Certified Payroll", pitbull: "yes", procore: "no", vista: "yes", sage: "yes", foundation: "yes", hcss: "yes" },
    { feature: "Document Management", pitbull: "yes", procore: "yes", vista: "yes", sage: "partial", foundation: "partial", hcss: "partial" },
    { feature: "RFIs & Submittals", pitbull: "yes", procore: "yes", vista: "partial", sage: "no", foundation: "no", hcss: "no" },
    { feature: "Daily Reports", pitbull: "yes", procore: "yes", vista: "partial", sage: "no", foundation: "no", hcss: "yes" },
    { feature: "Punch Lists", pitbull: "yes", procore: "yes", vista: "no", sage: "no", foundation: "no", hcss: "no" },
    { feature: "Schedule Management", pitbull: "yes", procore: "yes", vista: "partial", sage: "no", foundation: "no", hcss: "yes" },
  ],
};

const aiFeatures: AiCategorySection = {
  title: "AI-Powered Features",
  rows: [
    { feature: "AI Chat Assistant", pitbull: "yes", others: "no" },
    { feature: "Smart Field Suggestions", pitbull: "yes", others: "no" },
    { feature: "AI Document Intelligence", pitbull: "yes", others: "no" },
    { feature: "AI Invoice Extraction", pitbull: "yes", others: "no" },
    { feature: "AI Daily Report Summary", pitbull: "yes", others: "no" },
    { feature: "AI Data Entry Assist", pitbull: "yes", others: "no" },
    { feature: "Cost-to-Complete Prediction", pitbull: "yes", others: "no" },
  ],
};

const mobileField: CategorySection = {
  title: "Mobile & Field",
  rows: [
    { feature: "Mobile Web App", pitbull: "yes", procore: "yes", vista: "partial", sage: "no", foundation: "no", hcss: "yes" },
    { feature: "Camera/Photo Capture", pitbull: "yes", procore: "yes", vista: "no", sage: "no", foundation: "no", hcss: "yes" },
    { feature: "GPS Time Tracking", pitbull: "yes", procore: "no", vista: "no", sage: "no", foundation: "no", hcss: "yes" },
    { feature: "Mobile Daily Reports", pitbull: "yes", procore: "yes", vista: "no", sage: "no", foundation: "no", hcss: "yes" },
    { feature: "Mobile Time Entry", pitbull: "yes", procore: "no", vista: "partial", sage: "no", foundation: "no", hcss: "yes" },
  ],
};

const platformTech: CategorySection = {
  title: "Platform & Technology",
  rows: [
    { feature: "Modern Web Stack", pitbull: "yes", procore: "yes", vista: "no", sage: "no", foundation: "no", hcss: "partial" },
    { feature: "Self-Hosted Option", pitbull: "yes", procore: "no", vista: "partial", sage: "partial", foundation: "partial", hcss: "no" },
    { feature: "API-First Architecture", pitbull: "yes", procore: "yes", vista: "partial", sage: "no", foundation: "no", hcss: "partial" },
    { feature: "Real-Time Updates", pitbull: "yes", procore: "yes", vista: "no", sage: "no", foundation: "no", hcss: "no" },
    { feature: "Dark Mode", pitbull: "yes", procore: "no", vista: "no", sage: "no", foundation: "no", hcss: "no" },
    { feature: "Multi-Tenant", pitbull: "yes", procore: "yes", vista: "no", sage: "no", foundation: "no", hcss: "yes" },
    { feature: "Role-Based Access", pitbull: "yes", procore: "yes", vista: "yes", sage: "yes", foundation: "yes", hcss: "yes" },
  ],
};

const businessModel: CategorySection = {
  title: "Business Model",
  rows: [
    { feature: "Simple Per-User Pricing", pitbull: "yes", procore: "no", vista: "no", sage: "no", foundation: "no", hcss: "no" },
    { feature: "No Implementation Fee", pitbull: "yes", procore: "no", vista: "no", sage: "no", foundation: "no", hcss: "no" },
    { feature: "Unlimited Projects", pitbull: "yes", procore: "no", vista: "yes", sage: "yes", foundation: "yes", hcss: "yes" },
  ],
};

const allCategories: CategorySection[] = [coreModules, mobileField, platformTech, businessModel];

// --- Icon Components ---

function SupportIcon({ value, size = "default" }: { value: Support; size?: "default" | "sm" }) {
  const sizeClass = size === "sm" ? "size-4" : "size-5";
  switch (value) {
    case "yes":
      return <Check className={`${sizeClass} text-green-500`} aria-label="Included" />;
    case "no":
      return <X className={`${sizeClass} text-neutral-300 dark:text-neutral-600`} aria-label="Not included" />;
    case "partial":
      return <Minus className={`${sizeClass} text-amber-500`} aria-label="Partial support" />;
  }
}

// --- Desktop Table ---

function DesktopTable({ section }: { section: CategorySection }) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[220px]">Feature</th>
            <th className="py-3 px-4 font-semibold text-center bg-amber-50 dark:bg-amber-950/30 w-[120px]">Pitbull</th>
            {competitors.map((c) => (
              <th key={c.key} className="py-3 px-4 font-medium text-center text-muted-foreground w-[120px]">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.feature} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-4 font-medium">{row.feature}</td>
              <td className="py-3 px-4 bg-amber-50 dark:bg-amber-950/30">
                <div className="flex justify-center">
                  <SupportIcon value={row.pitbull} />
                </div>
              </td>
              {competitors.map((c) => (
                <td key={c.key} className="py-3 px-4">
                  <div className="flex justify-center">
                    <SupportIcon value={row[c.key]} />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DesktopAiTable({ section }: { section: AiCategorySection }) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
            <th className="py-3 px-4 font-semibold text-center bg-amber-50 dark:bg-amber-950/30 w-[120px]">Pitbull</th>
            <th className="py-3 px-4 font-medium text-center text-muted-foreground" colSpan={5}>
              All Others
            </th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.feature} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-4 font-medium">{row.feature}</td>
              <td className="py-3 px-4 bg-amber-50 dark:bg-amber-950/30">
                <div className="flex justify-center">
                  <SupportIcon value={row.pitbull} />
                </div>
              </td>
              <td className="py-3 px-4" colSpan={5}>
                <div className="flex justify-center">
                  <SupportIcon value={row.others} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Mobile Card View ---

function MobileComparisonCards({ section }: { section: CategorySection }) {
  const [selected, setSelected] = useState(0);
  const competitor = competitors[selected];

  return (
    <div className="lg:hidden">
      <div className="mb-4 relative">
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="w-full appearance-none rounded-lg border bg-background px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {competitors.map((c, i) => (
            <option key={c.key} value={i}>
              Pitbull vs {c.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      </div>

      <div className="space-y-1">
        {section.rows.map((row) => (
          <div
            key={row.feature}
            className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium flex-1">{row.feature}</span>
            <div className="flex items-center gap-6 shrink-0">
              <div className="flex flex-col items-center gap-1 w-16">
                <SupportIcon value={row.pitbull} size="sm" />
                <span className="text-[10px] text-muted-foreground font-medium">Pitbull</span>
              </div>
              <div className="flex flex-col items-center gap-1 w-16">
                <SupportIcon value={row[competitor.key]} size="sm" />
                <span className="text-[10px] text-muted-foreground">{competitor.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileAiCards({ section }: { section: AiCategorySection }) {
  return (
    <div className="lg:hidden space-y-1">
      {section.rows.map((row) => (
        <div
          key={row.feature}
          className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors"
        >
          <span className="text-sm font-medium flex-1">{row.feature}</span>
          <div className="flex items-center gap-6 shrink-0">
            <div className="flex flex-col items-center gap-1 w-16">
              <SupportIcon value={row.pitbull} size="sm" />
              <span className="text-[10px] text-muted-foreground font-medium">Pitbull</span>
            </div>
            <div className="flex flex-col items-center gap-1 w-16">
              <SupportIcon value={row.others} size="sm" />
              <span className="text-[10px] text-muted-foreground">Others</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Legend ---

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Check className="size-4 text-green-500" />
        <span>Included</span>
      </div>
      <div className="flex items-center gap-2">
        <Minus className="size-4 text-amber-500" />
        <span>Partial</span>
      </div>
      <div className="flex items-center gap-2">
        <X className="size-4 text-neutral-300 dark:text-neutral-600" />
        <span>Not available</span>
      </div>
    </div>
  );
}

// --- Stat Counter ---

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-amber-500">{number}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// --- Page Component ---

export default function ComparisonPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-950 px-4 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 mb-6">
            <HardHat className="size-4" />
            Construction Software Comparison
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            One Platform. Every Module.{" "}
            <span className="text-amber-500">One Price.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            See how Pitbull Construction Solutions compares to legacy construction
            software. Every feature you need, in a single modern platform.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-amber-500 px-8 text-base font-semibold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
            >
              Request a Demo
            </Link>
            <a
              href="#comparison"
              className="inline-flex h-12 items-center justify-center rounded-lg border px-8 text-base font-medium hover:bg-muted/50 transition-colors"
            >
              View Comparison
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard number="14" label="Integrated Modules" />
            <StatCard number="7" label="AI Features" />
            <StatCard number="100+" label="Pages & Views" />
            <StatCard number="4" label="Demo Companies" />
          </div>
        </div>
      </section>

      {/* Comparison Tables */}
      <section id="comparison" className="py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Feature-by-Feature Comparison</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Pitbull replaces your entire stack. One login, one database, one
              vendor.
            </p>
          </div>

          <Legend />

          <div className="mt-10 space-y-16">
            {/* Core Modules */}
            {allCategories.map((section) => (
              <div key={section.title}>
                <h3 className="text-xl font-semibold mb-4 pb-2 border-b">
                  {section.title}
                </h3>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <DesktopTable section={section} />
                  <MobileComparisonCards section={section} />
                </div>
              </div>
            ))}

            {/* AI Features (special two-column layout) */}
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b">
                {aiFeatures.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Pitbull is the only construction platform with AI built into the
                architecture — not bolted on as an afterthought.
              </p>
              <div className="rounded-xl border bg-card overflow-hidden">
                <DesktopAiTable section={aiFeatures} />
                <MobileAiCards section={aiFeatures} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Switch */}
      <section className="bg-neutral-50 dark:bg-neutral-950 py-16 sm:py-24 border-t">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Why Teams Switch to Pitbull
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "One Vendor, One Price",
                description:
                  "Stop juggling Procore for field, Vista for accounting, and spreadsheets for everything else. Pitbull covers the entire workflow at a simple per-user price.",
              },
              {
                title: "Zero Implementation Cost",
                description:
                  "Legacy ERPs charge $50K-$500K for implementation. Pitbull is self-service with guided onboarding. Start in hours, not months.",
              },
              {
                title: "AI That Understands Construction",
                description:
                  "Our AI isn't a chatbot wrapper. It reads your cost codes, predicts overruns, extracts invoices, and writes daily report summaries.",
              },
              {
                title: "Built for the Field",
                description:
                  "Mobile-first time entry, camera-based daily reports, GPS tracking. Your crew doesn't need training — it just works.",
              },
              {
                title: "Modern Architecture",
                description:
                  "Real-time updates, dark mode, API-first design, and a tech stack from this decade. No more green-screen ERPs.",
              },
              {
                title: "Self-Hosted Option",
                description:
                  "Keep your data on your servers. Full control, full compliance. No vendor lock-in.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to modernize your construction business?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Join the next generation of general contractors running their entire
            operation from one platform.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-amber-500 px-8 text-base font-semibold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
            >
              Request a Demo
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border px-8 text-base font-medium hover:bg-muted/50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
