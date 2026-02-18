"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  BarChart3,
  Wrench,
  CalendarDays,
  LineChart,
  Upload,
} from "lucide-react";

const reports = [
  {
    title: "Labor Cost",
    description: "Analyze labor costs by project, employee, and date range with overtime breakdowns.",
    href: "/reports/labor-cost",
    icon: DollarSign,
  },
  {
    title: "Project Profitability",
    description: "Compare budgeted vs actual costs across projects to track margins.",
    href: "/reports/project-profitability",
    icon: BarChart3,
  },
  {
    title: "Equipment Utilization",
    description: "Track equipment usage rates, costs, and availability across projects.",
    href: "/reports/equipment",
    icon: Wrench,
  },
  {
    title: "Weekly Summary",
    description: "Week-by-week summary of hours, costs, and productivity metrics.",
    href: "/reports/weekly-summary",
    icon: CalendarDays,
  },
  {
    title: "Financial Overview",
    description: "High-level financial dashboard with revenue, costs, and cash flow trends.",
    href: "/reports/financial-overview",
    icon: LineChart,
  },
  {
    title: "Vista Export",
    description: "Export timecard and cost data in Viewpoint Vista compatible format.",
    href: "/reports/vista-export",
    icon: Upload,
  },
];

export default function ReportsIndexPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and view reports across your projects and workforce.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full transition-colors hover:border-amber-500/50 hover:shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    <report.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
