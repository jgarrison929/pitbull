"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { BarChart3 } from "lucide-react";

interface WipReportListItem {
  id: string;
  reportDate: string;
  fiscalYear: number;
  periodNumber: number;
  status: "Draft" | "Final";
  statusName: string;
  lineCount: number;
  createdAt: string;
}

interface ListWipReportsResult {
  items: WipReportListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface GenerateWipReportRequest {
  reportDate: string;
  fiscalYear: number;
  periodNumber: number;
  status: "Draft" | "Final";
}

function getDefaultPeriod(date: Date): { fiscalYear: number; periodNumber: number } {
  return {
    fiscalYear: date.getUTCFullYear(),
    periodNumber: date.getUTCMonth() + 1,
  };
}

export default function WipReportsPage() {
  const [reports, setReports] = useState<WipReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  const defaultPeriod = getDefaultPeriod(today);

  const [reportDate, setReportDate] = useState(today.toISOString().slice(0, 10));
  const [fiscalYear, setFiscalYear] = useState(String(defaultPeriod.fiscalYear));
  const [periodNumber, setPeriodNumber] = useState(String(defaultPeriod.periodNumber));

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListWipReportsResult>("/api/wip-reports?page=1&pageSize=100");
      setReports(result.items);
    } catch {
      toast.error("Failed to load WIP reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function exportPdf() {
    try {
      const token = getToken();
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const activeCompanyId = localStorage.getItem("pitbull_active_company_id");
      if (activeCompanyId) headers["X-Company-Id"] = activeCompanyId;

      const response = await fetch(`${API_BASE_URL}/api/reports/pdf/wip-schedule`, { headers });
      if (!response.ok) throw new Error(`Failed with status ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wip-schedule-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("WIP PDF exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export WIP PDF");
    }
  }

  async function handleGenerate() {
    const parsedYear = Number(fiscalYear);
    const parsedPeriod = Number(periodNumber);

    if (!reportDate || Number.isNaN(parsedYear) || Number.isNaN(parsedPeriod)) {
      toast.error("Report date, fiscal year, and period are required");
      return;
    }

    if (parsedPeriod < 1 || parsedPeriod > 12) {
      toast.error("Period number must be 1-12");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: GenerateWipReportRequest = {
        reportDate,
        fiscalYear: parsedYear,
        periodNumber: parsedPeriod,
        status: "Draft",
      };

      await api("/api/wip-reports/generate", { method: "POST", body: payload });
      toast.success("WIP report generated");
      setDialogOpen(false);
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate WIP report");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WIP Schedule</h1>
          <p className="text-muted-foreground">Work-in-progress snapshots by accounting period</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPdf}>Export PDF</Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setDialogOpen(true)}>
            Generate WIP Report
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton headers={["Report Date", "Period", "Status", "Projects", "Created", "Actions"]} rows={8} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No WIP reports"
          description="Generate the first WIP report for your current period."
          actionLabel="Generate WIP Report"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{new Date(report.reportDate + "T00:00:00").toLocaleDateString()}</TableCell>
                    <TableCell>{report.fiscalYear} / P{report.periodNumber}</TableCell>
                    <TableCell>
                      <Badge variant={report.status === "Final" ? "default" : "secondary"}>{report.statusName}</Badge>
                    </TableCell>
                    <TableCell>{report.lineCount}</TableCell>
                    <TableCell>{new Date(report.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/accounting/wip/${report.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate WIP Report</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Report Date</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period Number</Label>
              <Input value={periodNumber} onChange={(e) => setPeriodNumber(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isSubmitting} onClick={handleGenerate}>
              Generate
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
