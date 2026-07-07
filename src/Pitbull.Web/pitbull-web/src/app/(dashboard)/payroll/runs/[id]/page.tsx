"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface PayrollRunLineDto {
  id: string;
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  grossPay: number;
}

interface PayrollRunDto {
  id: string;
  runDate: string;
  payPeriodId: string;
  statusName: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  lines: PayrollRunLineDto[];
}

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;

  const [run, setRun] = useState<PayrollRunDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchRun = useCallback(async () => {
    if (!runId) return;
    setIsLoading(true);
    try {
      const result = await api<PayrollRunDto>(`/api/payroll/runs/${runId}`);
      setRun(result);
    } catch {
      toast.error("Failed to load payroll run");
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  async function approveRun() {
    if (!runId) return;
    setIsApproving(true);
    try {
      await api(`/api/payroll/runs/${runId}/approve`, { method: "POST" });
      toast.success("Payroll run approved");
      fetchRun();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve payroll run");
    } finally {
      setIsApproving(false);
    }
  }

  async function exportRun() {
    if (!runId) return;
    setIsExporting(true);
    try {
      const exported = await api<PayrollRunDto>(`/api/payroll/runs/${runId}/export`, { method: "POST" });
      setRun(exported);
      toast.success("Payroll run exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export payroll run");
    } finally {
      setIsExporting(false);
    }
  }

  async function exportWh347Pdf() {
    if (!runId) return;
    try {
      const token = getToken();
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const activeCompanyId = localStorage.getItem("pitbull_active_company_id");
      if (activeCompanyId) headers["X-Company-Id"] = activeCompanyId;

      const response = await fetch(`${API_BASE_URL}/api/reports/pdf/wh347/${runId}`, { headers });
      if (!response.ok) throw new Error(`Failed with status ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wh347-${runId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("WH-347 PDF exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export WH-347 PDF");
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <TableSkeleton
          rows={8}
          headers={["Employee ID", "Reg Hrs", "OT Hrs", "DT Hrs", "Gross Pay"]}
        />
      ) : run ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payroll Run Detail</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Run date {run.runDate}</p>
              </div>
              <Badge variant="secondary">{run.statusName}</Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-xl font-semibold">{run.employeeCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross</p>
                <p className="text-xl font-semibold">${run.totalGross.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net</p>
                <p className="text-xl font-semibold">${run.totalNet.toFixed(2)}</p>
              </div>
              <div className="sm:col-span-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={exportWh347Pdf}>Export PDF</Button>
                  <Button onClick={approveRun} disabled={isApproving} className="bg-amber-500 hover:bg-amber-600 text-white">
                    {isApproving ? "Approving..." : "Approve Run"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportRun}
                    disabled={isExporting || run.statusName !== "Approved"}
                  >
                    {isExporting ? "Exporting..." : "Export Run"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead className="text-right">Reg Hrs</TableHead>
                    <TableHead className="text-right">OT Hrs</TableHead>
                    <TableHead className="text-right">DT Hrs</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs">{line.employeeId}</TableCell>
                      <TableCell className="text-right">{line.regularHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{line.overtimeHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{line.doubletimeHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${line.grossPay.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
