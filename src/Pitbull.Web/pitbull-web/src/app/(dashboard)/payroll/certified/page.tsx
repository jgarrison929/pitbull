"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface CertifiedPayrollReportDto {
  id: string;
  payrollRunId: string;
  projectId: string;
  weekEnding: string;
  whdFormNumber: string;
  statusName: string;
}

interface ListResult {
  items: CertifiedPayrollReportDto[];
}

export default function CertifiedPayrollPage() {
  const [reports, setReports] = useState<CertifiedPayrollReportDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [payrollRunId, setPayrollRunId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [weekEnding, setWeekEnding] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/certified?page=1&pageSize=100");
      setReports(result.items);
    } catch {
      toast.error("Failed to load certified payroll reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function handleGenerate() {
    if (!payrollRunId.trim() || !projectId.trim() || !weekEnding) {
      toast.error("Payroll run ID, project ID, and week ending are required");
      return;
    }

    setIsGenerating(true);
    try {
      await api("/api/payroll/certified/generate", {
        method: "POST",
        body: {
          payrollRunId: payrollRunId.trim(),
          projectId: projectId.trim(),
          weekEnding,
        },
      });
      toast.success("Certified payroll generated");
      fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate certified payroll");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownloadWh347(reportPayrollRunId: string) {
    try {
      setDownloading(reportPayrollRunId);
      const token = getToken();
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const activeCompanyId = localStorage.getItem("pitbull_active_company_id");
      if (activeCompanyId) headers["X-Company-Id"] = activeCompanyId;

      const response = await fetch(
        `${API_BASE_URL}/api/payroll/certified/${reportPayrollRunId}/wh347-pdf`,
        { headers }
      );

      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `WH-347-${reportPayrollRunId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("WH-347 PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download WH-347 PDF");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certified Payroll</h1>
        <p className="text-muted-foreground">Generate and track WH-347 reports by project and week</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate WH-347</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="payrollRunId">Payroll Run ID</Label>
            <Input id="payrollRunId" value={payrollRunId} onChange={(e) => setPayrollRunId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectId">Project ID</Label>
            <Input id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weekEnding">Week Ending</Label>
            <Input id="weekEnding" type="date" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)} />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="bg-amber-500 hover:bg-amber-600 text-white">
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certified Payroll Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton
              rows={8}
              headers={["Week Ending", "Project", "Payroll Run", "Form", "Status", "Actions"]}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week Ending</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Payroll Run</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.weekEnding}</TableCell>
                    <TableCell className="font-mono text-xs">{report.projectId}</TableCell>
                    <TableCell className="font-mono text-xs">{report.payrollRunId}</TableCell>
                    <TableCell>{report.whdFormNumber}</TableCell>
                    <TableCell><Badge variant="secondary">{report.statusName}</Badge></TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadWh347(report.payrollRunId)}
                        disabled={downloading === report.payrollRunId}
                      >
                        {downloading === report.payrollRunId ? "Downloading..." : "Export WH-347 PDF"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
