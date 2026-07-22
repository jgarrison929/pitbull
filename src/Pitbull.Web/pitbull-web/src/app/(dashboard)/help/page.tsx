"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  HardHat,
  Clock,
  FileText,
  BarChart3,
  Users,
  Settings,
  ChevronRight,
  HelpCircle,
  Wrench,
  DollarSign,
  Upload,
  BookOpen,
  Smartphone,
  MapPin,
  WifiOff,
  Boxes,
  Inbox,
  Building2,
  type LucideIcon,
} from "lucide-react";
import {
  fieldWorkflowCards,
  FIELD_WORKFLOWS_SECTION_TITLE,
  mobileFaqItems,
  type FieldWorkflowCard,
} from "@/lib/help-field-workflows";
import {
  TWIN_TRUTH_LEGEND_SECTION_TITLE,
  twinTruthBands,
  twinTruthLegendBullets,
} from "@/lib/help-twin-overlays";
import {
  ZONE_PICKER_TWIN_SECTION_TITLE,
  zonePickerTwinBullets,
  zonePickerTwinSteps,
} from "@/lib/help-zone-picker-twin";
import {
  APPROVALS_HELP_SECTION_TITLE,
  approvalsFaqItems,
  approvalsHelpCards,
} from "@/lib/help-approvals";
import {
  HELP_PM_RFI_SUBMITTAL_CARDS,
  PM_RFI_SUBMITTAL_HELP_SECTION_TITLE,
  pmRfiSubmittalFaqItems,
} from "@/lib/help-pm-rfi-submittal";
import {
  HELP_PM_CO_CONTRACTS_CARDS,
  PM_CO_CONTRACTS_HELP_SECTION_TITLE,
  pmCoContractsFaqItems,
} from "@/lib/help-pm-co-contracts";
import {
  HELP_PM_SCHEDULE_CARDS,
  PM_SCHEDULE_HELP_SECTION_TITLE,
  pmScheduleFaqItems,
} from "@/lib/help-pm-schedule";
import {
  OFFICE_WORKFLOWS_SECTION_TITLE,
  officeFaqItems,
  officeHelpCards,
} from "@/lib/help-office-workflows";
import {
  TODAY_ON_SITE_HELP_SECTION_TITLE,
  HELP_TODAY_ON_SITE_CARDS,
  todayOnSiteFaqItems,
} from "@/lib/help-today-on-site";

const fieldWorkflowIcons: Record<FieldWorkflowCard["icon"], LucideIcon> = {
  "file-text": FileText,
  "map-pin": MapPin,
  "wifi-off": WifiOff,
};

const quickStartSteps = [
  {
    step: 1,
    title: "Complete Company Setup",
    description:
      "Add your company name, address, tax ID, and contractor type in the company setup wizard.",
    href: "/settings/company/setup",
  },
  {
    step: 2,
    title: "Import or Add Employees",
    description:
      "Add your workforce manually or bulk-import from Vista CSV. Employees are needed for time tracking.",
    href: "/employees",
  },
  {
    step: 3,
    title: "Set Up Cost Codes",
    description:
      "Review the default cost code structure or import your own. Cost codes categorize labor and materials.",
    href: "/cost-codes",
  },
  {
    step: 4,
    title: "Create Your First Project",
    description:
      "Add a project with its contract value, start/end dates, and assigned team members.",
    href: "/projects",
  },
  {
    step: 5,
    title: "Start Tracking Time",
    description:
      "Enter daily time for your crew or use mobile entry. Approve timecards weekly for payroll export.",
    href: "/time-tracking",
  },
];

const featureCards = [
  {
    title: "Projects",
    description: "Create and manage construction projects with budgets, schedules, and team assignments.",
    icon: HardHat,
    href: "/projects",
  },
  {
    title: "Time Tracking",
    description: "Daily crew time entry, approval workflows, overtime rules, and Vista payroll export.",
    icon: Clock,
    href: "/time-tracking",
  },
  {
    title: "Bids & Estimating",
    description: "Manage bid proposals and convert winning bids directly into active projects.",
    icon: FileText,
    href: "/bids",
  },
  {
    title: "Contracts & Change Orders",
    description: "Track subcontracts, change orders, and revised contract values.",
    icon: DollarSign,
    href: "/contracts",
  },
  {
    title: "Reports",
    description: "Labor cost, project profitability, weekly summary, and equipment utilization reports.",
    icon: BarChart3,
    href: "/reports",
  },
  {
    title: "Equipment",
    description: "Track equipment inventory, hourly rates, and utilization across projects.",
    icon: Wrench,
    href: "/equipment",
  },
  {
    title: "Employee Management",
    description: "Manage your workforce, pay rates, classifications, and certifications.",
    icon: Users,
    href: "/employees",
  },
  {
    title: "Data Import",
    description: "Bulk import projects, employees, cost codes, and time entries from Vista CSV files.",
    icon: Upload,
    href: "/admin/data-import",
  },
];

const faqItems = [
  {
    question: "How do I import data from Trimble Vista?",
    answer:
      "Go to Admin > Data Import. Select the data type (employees, projects, cost codes, etc.), download the CSV template, fill it with your Vista data, then upload. Pitbull validates every row before importing.",
  },
  {
    question: "How do I track employee time?",
    answer:
      "Navigate to Time Tracking and use daily entry or crew entry mode. Assign employees to projects and cost codes, enter hours, then submit for approval. Managers can approve or reject timecards.",
  },
  {
    question: "How do I manage change orders?",
    answer:
      "Open a project, then go to its Change Orders tab. Add change orders with descriptions and amounts. Approved change orders automatically update the revised contract value.",
  },
  {
    question: "How do I generate reports?",
    answer:
      "Visit the Reports section in the sidebar. Choose from weekly summary, labor cost, project profitability, financial overview, or equipment utilization. All reports support CSV export.",
  },
  {
    question: "What are cost codes and how do I set them up?",
    answer:
      "Cost codes categorize project expenses (labor, materials, equipment, etc.). Go to Cost Codes to view defaults or import your own structure from Vista. Each time entry is tagged with a cost code.",
  },
  {
    question: "How do I manage user access and roles?",
    answer:
      "Admins can manage users under Admin > Users. Assign roles like Admin, Manager, or Field to control what each user can see and do. Managers can approve time; field users can only enter time.",
  },
  {
    question: "How do I export data for payroll?",
    answer:
      "Go to Admin > Data Import, switch to the Export tab, and select Time Entries with Vista format. Choose a date range to generate a Vista-compatible CSV file for payroll processing.",
  },
  // 2.12.8 accurate mobile FAQ (field paths, offline, twin/plans) — see mobileFaqItems
  ...mobileFaqItems,
  // 2.21.9 approvals workflow
  ...approvalsFaqItems,
  // 2.22.2 office personas / KPI drill truth
  ...officeFaqItems,
  // 3.3.6 Today on site — real entities only
  ...todayOnSiteFaqItems,
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Help" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-amber-500" />
          Help Center
        </h1>
        <p className="text-muted-foreground">
          Everything you need to get started with Pitbull Construction Solutions.
        </p>
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {quickStartSteps.map((item) => (
              <li key={item.step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-sm font-bold">
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={item.href}
                    className="font-medium hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Feature Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Feature Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="h-full hover:border-amber-300 dark:hover:border-amber-700 transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <feature.icon className="h-8 w-8 text-amber-500 mb-3" />
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Field & mobile workflows (2.12.7) */}
      <div data-testid="help-field-workflows">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-amber-500" />
          {FIELD_WORKFLOWS_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Phone-first paths for superintendents and field crews. Links open the
          live app routes.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {fieldWorkflowCards.map((card) => {
            const Icon = fieldWorkflowIcons[card.icon];
            return (
              <Card
                key={card.id}
                data-testid={`help-field-card-${card.id}`}
                className="h-full"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-5 w-5 text-amber-500 shrink-0" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    {card.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    Open {card.title}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* RFIs + Submittals on phone (3.4.8) */}
      <div data-testid="help-pm-rfi-submittal">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-amber-500" />
          {PM_RFI_SUBMITTAL_HELP_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Phone-first RFI and submittal flows. Status and due only — never register health
          percentages or invented offline logs.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {HELP_PM_RFI_SUBMITTAL_CARDS.map((card) => (
            <Card key={card.id} data-testid={`help-pm-card-${card.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {card.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Open {card.title}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">FAQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pmRfiSubmittalFaqItems.map((item) => (
              <div key={item.question}>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Change orders + contracts on phone (3.5.8 / band 3.6) */}
      <div data-testid="help-pm-co-contracts">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" />
          {PM_CO_CONTRACTS_HELP_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Phone-first change order status and amount glance. Empty is honest — never a
          commercial health score.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {HELP_PM_CO_CONTRACTS_CARDS.map((card) => (
            <Card key={card.id} data-testid={`help-pm-card-${card.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {card.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Open {card.title}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">FAQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pmCoContractsFaqItems.map((item) => (
              <div key={item.question}>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Schedule + look-ahead on phone (3.6.8 / band 3.7–3.8 partial) */}
      <div data-testid="help-pm-schedule">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-amber-500" />
          {PM_SCHEDULE_HELP_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Phone look-ahead with real critical flags and float when the server has them.
          Never invented SPI/CPI or default on-track green.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {HELP_PM_SCHEDULE_CARDS.map((card) => (
            <Card key={card.id} data-testid={`help-pm-card-${card.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {card.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Open {card.title}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">FAQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pmScheduleFaqItems.map((item) => (
              <div key={item.question}>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Today on site (3.3.6) — real entities only, no health scores */}
      <div data-testid="help-today-on-site">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-amber-500" />
          {TODAY_ON_SITE_HELP_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Project glance of today&apos;s filed field activity. Counts come from real
          daily reports and RFIs — empty is honest, never a health score or portfolio
          rollup.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_TODAY_ON_SITE_CARDS.map((card) => (
            <Card key={card.id} data-testid={`help-today-card-${card.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {card.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Open {card.title}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Twin overlay truth legend (2.15.8) — never all-green default */}
      <div data-testid="help-twin-truth-legend">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-amber-500" />
          {TWIN_TRUTH_LEGEND_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          How to read Digital Twin overlay colors honestly. Empty or gray is not
          all-clear and is never painted green by default.
        </p>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <ul className="space-y-2">
              {twinTruthBands.map((b) => (
                <li key={b.id} className="text-sm">
                  <span className="font-medium">{b.band}: </span>
                  <span className="text-muted-foreground">{b.meaning}</span>
                </li>
              ))}
            </ul>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {twinTruthLegendBullets.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Zone picker + twin fuel (2.18.8) */}
      <div data-testid="help-zone-picker-twin">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-amber-500" />
          {ZONE_PICKER_TWIN_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          How field zone selection feeds Digital Twin. Optional by default; required
          only when company enables it. Empty twin panels stay neutral — not all-clear.
        </p>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <ul className="space-y-3">
              {zonePickerTwinBullets.map((b) => (
                <li key={b.id} className="text-sm">
                  <span className="font-medium">{b.title}: </span>
                  <span className="text-muted-foreground">{b.body}</span>
                </li>
              ))}
            </ul>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {zonePickerTwinSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Approvals workflow (2.21.9) */}
      <div data-testid="help-approvals-workflow">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Inbox className="h-5 w-5 text-amber-500" />
          {APPROVALS_HELP_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Time entries are the Phase 2 mobile approve lifecycle. Counts are live
          DB queries — empty means empty.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {approvalsHelpCards.map((card) => (
            <Card key={card.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {card.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline"
                >
                  Open {card.title}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Office workflows (2.22.1) — CEO / CFO / PM / Estimator */}
      <div data-testid="help-office-workflows">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-500" />
          {OFFICE_WORKFLOWS_SECTION_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Title-first role profiles drive home layout. Cards match live demo
          personas and KPI drill contracts — no invented metrics.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {officeHelpCards.map((card) => (
            <Card key={card.id} data-testid={`help-office-card-${card.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {card.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline"
                >
                  Open {card.title}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqItems.map((faq) => (
            <Card key={faq.question}>
              <CardContent className="pt-5 pb-5">
                <div className="flex gap-3">
                  <HelpCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium">{faq.question}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Support Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Settings className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <h3 className="font-semibold">Need more help?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Contact your system administrator or reach out to Pitbull support
                at{" "}
                <span className="font-medium text-foreground">
                  support@pitbullconstructionsolutions.com
                </span>
                . For keyboard shortcuts, press{" "}
                <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-muted border border-border rounded">
                  ?
                </kbd>{" "}
                anywhere in the app.
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  Privacy Policy <ChevronRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  Terms of Service <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
