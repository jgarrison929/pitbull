"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import {
  projectStatusLabel,
  projectTypeLabel,
} from "@/lib/projects";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type {
  Project,
  RfiCostSummary,
  ChangeOrder,
  TimeEntry,
  PagedResult,
  Subcontract,
} from "@/lib/types";
import { ChangeOrderStatus, TimeEntryStatus } from "@/lib/types";

interface ProjectStats {
  projectId: string;
  projectName: string;
  projectNumber: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalLaborCost: number;
  timeEntryCount: number;
  approvedEntryCount: number;
  pendingEntryCount: number;
  assignedEmployeeCount: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatHours(hours: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(hours);
}

function changeOrderStatusLabel(status: ChangeOrderStatus): string {
  switch (status) {
    case ChangeOrderStatus.Pending:
      return "Pending";
    case ChangeOrderStatus.UnderReview:
      return "Under Review";
    case ChangeOrderStatus.Approved:
      return "Approved";
    case ChangeOrderStatus.Rejected:
      return "Rejected";
    case ChangeOrderStatus.Withdrawn:
      return "Withdrawn";
    case ChangeOrderStatus.Void:
      return "Void";
    default:
      return "Unknown";
  }
}

function timeEntryStatusLabel(status: TimeEntryStatus): string {
  switch (status) {
    case TimeEntryStatus.Submitted:
      return "Submitted";
    case TimeEntryStatus.Approved:
      return "Approved";
    case TimeEntryStatus.Rejected:
      return "Rejected";
    case TimeEntryStatus.Draft:
      return "Draft";
    default:
      return "Unknown";
  }
}

export default function ProjectPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [rfiSummary, setRfiSummary] = useState<RfiCostSummary | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch all data in parallel
        const [projectData, statsData, rfiData, subcontractsData, timeData] =
          await Promise.all([
            api<Project>(`/api/projects/${id}`),
            api<ProjectStats>(`/api/projects/${id}/stats`).catch(() => null),
            api<RfiCostSummary>(`/api/projects/${id}/rfi-cost-summary`).catch(
              () => null
            ),
            api<PagedResult<Subcontract>>(
              `/api/subcontracts?projectId=${id}&pageSize=100`
            ).catch(() => null),
            api<PagedResult<TimeEntry>>(
              `/api/time-entries?projectId=${id}&pageSize=10`
            ).catch(() => null),
          ]);

        setProject(projectData);
        setStats(statsData);
        setRfiSummary(rfiData);
        setTimeEntries(timeData?.items || []);

        // Fetch change orders for each subcontract
        if (subcontractsData?.items?.length) {
          const coPromises = subcontractsData.items.map((sub) =>
            api<PagedResult<ChangeOrder>>(
              `/api/changeorders?subcontractId=${sub.id}&pageSize=100`
            ).catch(() => null)
          );
          const coResults = await Promise.all(coPromises);
          const allChangeOrders = coResults
            .filter(Boolean)
            .flatMap((r) => r?.items || []);
          setChangeOrders(allChangeOrders);
        }
      } catch {
        setError("Failed to load project data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Loading project summary...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{error || "Project not found"}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  // Calculate metrics
  const budgetUtilization =
    project.contractAmount > 0 && stats
      ? ((stats.totalLaborCost / project.contractAmount) * 100).toFixed(1)
      : null;

  // Active change orders (Pending or Under Review)
  const activeChangeOrders = changeOrders.filter(
    (co) =>
      co.status === ChangeOrderStatus.Pending ||
      co.status === ChangeOrderStatus.UnderReview
  );
  const approvedChangeOrdersTotal = changeOrders
    .filter((co) => co.status === ChangeOrderStatus.Approved)
    .reduce((sum, co) => sum + co.amount, 0);

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide non-print elements */
          .no-print,
          nav,
          aside,
          header,
          footer,
          .sidebar {
            display: none !important;
          }

          /* Reset page margins */
          @page {
            margin: 0.5in;
            size: letter;
          }

          /* Ensure content fills page */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Clean up backgrounds */
          .print-section {
            background: white !important;
            border: 1px solid #e5e5e5 !important;
            break-inside: avoid;
          }

          /* Ensure text is readable */
          * {
            color: black !important;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Action Bar - Hidden in print */}
        <div className="no-print flex items-center justify-between mb-6">
          <Breadcrumbs
            items={[
              { label: "Projects", href: "/projects" },
              { label: project.name, href: `/projects/${id}` },
              { label: "Print" },
            ]}
          />
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print Summary
          </Button>
        </div>

        {/* Header Section */}
        <div className="print-section border rounded-lg p-6 bg-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground font-mono">{project.number}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-muted">
                {projectStatusLabel(project.status)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Client</span>
              <span className="font-medium">{project.clientName || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Type</span>
              <span className="font-medium">{projectTypeLabel(project.type)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Start Date</span>
              <span className="font-medium">{formatDate(project.startDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Est. Completion</span>
              <span className="font-medium">
                {formatDate(project.estimatedCompletionDate)}
              </span>
            </div>
          </div>

          {project.description && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-muted-foreground block text-sm">Description</span>
              <p className="text-sm mt-1">{project.description}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Report generated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Key Metrics Section */}
        <div className="print-section border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">Key Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className="text-muted-foreground block text-sm">
                Contract Amount
              </span>
              <span className="text-2xl font-bold">
                {formatCurrency(project.contractAmount)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-sm">
                Labor Cost to Date
              </span>
              <span className="text-2xl font-bold text-green-600">
                {stats ? formatCurrency(stats.totalLaborCost) : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-sm">
                Budget Utilization
              </span>
              <span className="text-2xl font-bold">
                {budgetUtilization ? `${budgetUtilization}%` : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-sm">
                Total Hours Logged
              </span>
              <span className="text-2xl font-bold">
                {stats ? formatHours(stats.totalHours) : "—"}
              </span>
            </div>
          </div>

          {stats && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Regular Hours:</span>{" "}
                <span className="font-medium">
                  {formatHours(stats.regularHours)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Overtime:</span>{" "}
                <span className="font-medium text-amber-600">
                  {formatHours(stats.overtimeHours)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Double Time:</span>{" "}
                <span className="font-medium text-red-600">
                  {formatHours(stats.doubleTimeHours)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned Employees:</span>{" "}
                <span className="font-medium">{stats.assignedEmployeeCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* RFI Summary Section */}
        <div className="print-section border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">RFI Summary</h2>
          {rfiSummary && rfiSummary.totalRfis > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Total RFIs
                  </span>
                  <span className="text-2xl font-bold">{rfiSummary.totalRfis}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Open RFIs
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {rfiSummary.openRfis}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Overdue RFIs
                  </span>
                  <span
                    className={`text-2xl font-bold ${
                      rfiSummary.overdueRfis > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {rfiSummary.overdueRfis}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Total RFI Cost Impact
                  </span>
                  <span className="text-2xl font-bold text-amber-600">
                    {formatCurrency(rfiSummary.totalCost)}
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <span>Avg Resolution: {rfiSummary.averageResolutionDays.toFixed(1)} days</span>
                <span className="mx-2">•</span>
                <span>Total Delay: {rfiSummary.totalDelayDays} days</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No RFIs recorded for this project.
            </p>
          )}
        </div>

        {/* Change Orders Summary Section */}
        <div className="print-section border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">Change Orders Summary</h2>
          {changeOrders.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Total Change Orders
                  </span>
                  <span className="text-2xl font-bold">{changeOrders.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Active (Pending/Review)
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {activeChangeOrders.length}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Approved Total
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(approvedChangeOrdersTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-sm">
                    Pending Total
                  </span>
                  <span className="text-2xl font-bold text-amber-600">
                    {formatCurrency(
                      activeChangeOrders.reduce((sum, co) => sum + co.amount, 0)
                    )}
                  </span>
                </div>
              </div>

              {activeChangeOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-medium mb-2">Active Change Orders</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="pb-2">Number</th>
                        <th className="pb-2">Title</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeChangeOrders.slice(0, 10).map((co) => (
                        <tr key={co.id} className="border-b border-dashed">
                          <td className="py-2 font-mono text-xs">
                            {co.changeOrderNumber}
                          </td>
                          <td className="py-2">{co.title}</td>
                          <td className="py-2">{changeOrderStatusLabel(co.status)}</td>
                          <td className="py-2 text-right font-mono">
                            {formatCurrency(co.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activeChangeOrders.length > 10 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ... and {activeChangeOrders.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No change orders recorded for this project.
            </p>
          )}
        </div>

        {/* Recent Time Entries Section */}
        <div className="print-section border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">Recent Time Entries</h2>
          {timeEntries.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Cost Code</th>
                  <th className="pb-2 text-right">Hours</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-dashed">
                    <td className="py-2">{formatDate(entry.date)}</td>
                    <td className="py-2">{entry.employeeName}</td>
                    <td className="py-2 text-xs">{entry.costCodeDescription}</td>
                    <td className="py-2 text-right font-mono">
                      {formatHours(entry.totalHours)}
                    </td>
                    <td className="py-2">{timeEntryStatusLabel(entry.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No time entries recorded for this project.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Pitbull Construction ERP • Project Summary Report</p>
        </div>
      </div>
    </>
  );
}
