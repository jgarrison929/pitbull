"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { TableSkeleton } from "@/components/skeletons";
import { BookOpen, CheckCircle } from "lucide-react";

interface WipReportLine {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  contractAmount: number;
  approvedChangeOrders: number;
  revisedContractAmount: number;
  totalCostToDate: number;
  estimatedCostToComplete: number;
  estimatedTotalCost: number;
  percentComplete: number;
  earnedRevenue: number;
  billedToDate: number;
  overUnderBilling: number;
  overUnderClassification: "Flat" | "UnderBilled" | "OverBilled";
}

interface WipReport {
  id: string;
  reportDate: string;
  fiscalYear: number;
  periodNumber: number;
  status: "Draft" | "Final";
  statusName: string;
  generatedById: string;
  lines: WipReportLine[];
  glJournalEntryId: string | null;
  postedToGlAt: string | null;
  postedToGlBy: string | null;
}

interface WipGlPostResult {
  wipReportId: string;
  journalEntryId: string;
  journalEntryNumber: string;
  totalDebits: number;
  totalCredits: number;
  lineCount: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export default function WipReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = params?.id;

  const [report, setReport] = useState<WipReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!reportId) return;

      setIsLoading(true);
      try {
        const result = await api<WipReport>(`/api/wip-reports/${reportId}`);
        setReport(result);
      } catch {
        toast.error("Failed to load WIP report");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [reportId]);

  const totals = useMemo(() => {
    if (!report) {
      return {
        revisedContractAmount: 0,
        totalCostToDate: 0,
        estimatedCostToComplete: 0,
        estimatedTotalCost: 0,
        earnedRevenue: 0,
        billedToDate: 0,
        overUnderBilling: 0,
      };
    }

    return report.lines.reduce(
      (acc, line) => ({
        revisedContractAmount: acc.revisedContractAmount + line.revisedContractAmount,
        totalCostToDate: acc.totalCostToDate + line.totalCostToDate,
        estimatedCostToComplete: acc.estimatedCostToComplete + line.estimatedCostToComplete,
        estimatedTotalCost: acc.estimatedTotalCost + line.estimatedTotalCost,
        earnedRevenue: acc.earnedRevenue + line.earnedRevenue,
        billedToDate: acc.billedToDate + line.billedToDate,
        overUnderBilling: acc.overUnderBilling + line.overUnderBilling,
      }),
      {
        revisedContractAmount: 0,
        totalCostToDate: 0,
        estimatedCostToComplete: 0,
        estimatedTotalCost: 0,
        earnedRevenue: 0,
        billedToDate: 0,
        overUnderBilling: 0,
      }
    );
  }, [report]);

  async function handlePostToGl() {
    if (!reportId) return;

    setIsPosting(true);
    try {
      const result = await api<WipGlPostResult>(`/api/wip-reports/${reportId}/post-to-gl`, {
        method: "POST",
      });
      toast.success(`Posted to GL: ${result.journalEntryNumber} (${result.lineCount} lines)`);
      setConfirmOpen(false);
      // Reload report to reflect posted status
      const updated = await api<WipReport>(`/api/wip-reports/${reportId}`);
      setReport(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post to GL");
    } finally {
      setIsPosting(false);
    }
  }

  const canPostToGl = report?.status === "Final" && !report?.glJournalEntryId;
  const isPostedToGl = !!report?.glJournalEntryId;

  if (isLoading) {
    return <TableSkeleton headers={["Project", "Contract", "Cost", "%", "Earned", "Billed", "Over/Under"]} rows={8} />;
  }

  if (!report) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">WIP Report</h1>
        <p className="text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WIP Detail</h1>
          <p className="text-muted-foreground">
            {report.fiscalYear} Period {report.periodNumber} &bull; {report.reportDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={report.status === "Final" ? "default" : "secondary"}>{report.statusName}</Badge>
          {isPostedToGl ? (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Posted to GL
            </Badge>
          ) : canPostToGl ? (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => setConfirmOpen(true)}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Post to GL
            </Button>
          ) : null}
        </div>
      </div>

      {isPostedToGl && report.postedToGlAt && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span>
              Posted to GL on {new Date(report.postedToGlAt).toLocaleDateString()} &mdash;{" "}
              <a
                href={`/accounting/journal-entries`}
                className="underline hover:no-underline"
              >
                View Journal Entry
              </a>
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Work In Progress Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Revised Contract</TableHead>
                <TableHead className="text-right">Cost To Date</TableHead>
                <TableHead className="text-right">Est. To Complete</TableHead>
                <TableHead className="text-right">Est. Total Cost</TableHead>
                <TableHead className="text-right">% Complete</TableHead>
                <TableHead className="text-right">Earned Revenue</TableHead>
                <TableHead className="text-right">Billed To Date</TableHead>
                <TableHead className="text-right">Over / Under</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="font-medium">{line.projectNumber}</div>
                    <div className="text-xs text-muted-foreground">{line.projectName}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(line.revisedContractAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.totalCostToDate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.estimatedCostToComplete)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.estimatedTotalCost)}</TableCell>
                  <TableCell className="text-right">{formatPercent(line.percentComplete)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.earnedRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.billedToDate)}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      line.overUnderBilling < 0 ? "text-red-600" : line.overUnderBilling > 0 ? "text-green-600" : ""
                    }`}
                  >
                    {formatCurrency(line.overUnderBilling)}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="bg-muted/30 font-semibold">
                <TableCell>Totals</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.revisedContractAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.totalCostToDate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.estimatedCostToComplete)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.estimatedTotalCost)}</TableCell>
                <TableCell className="text-right">
                  {totals.estimatedTotalCost <= 0
                    ? "0.00%"
                    : formatPercent(totals.totalCostToDate / totals.estimatedTotalCost)}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(totals.earnedRevenue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.billedToDate)}</TableCell>
                <TableCell
                  className={`text-right ${
                    totals.overUnderBilling < 0 ? "text-red-600" : totals.overUnderBilling > 0 ? "text-green-600" : ""
                  }`}
                >
                  {formatCurrency(totals.overUnderBilling)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post WIP to General Ledger</DialogTitle>
            <DialogDescription>
              This will create journal entries for over/under billing adjustments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              This action creates a journal entry with debit/credit lines for each project
              with over or under billing:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Underbilled</strong> (earned &gt; billed): Debit Costs in Excess, Credit Revenue</li>
              <li><strong>Overbilled</strong> (billed &gt; earned): Debit Revenue, Credit Billings in Excess</li>
            </ul>
            <p className="text-amber-600 font-medium">
              This action cannot be undone from the WIP screen. The journal entry can be reversed
              from the Journal Entries page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isPosting} onClick={handlePostToGl}>
              <BookOpen className="h-4 w-4 mr-1" />
              Post to GL
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
