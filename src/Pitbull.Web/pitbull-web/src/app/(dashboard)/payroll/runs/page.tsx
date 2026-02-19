"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface PayrollRunDto {
  id: string;
  runDate: string;
  payPeriodId: string;
  statusName: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
}

interface ListResult {
  items: PayrollRunDto[];
}

export default function PayrollRunsPage() {
  const [runs, setRuns] = useState<PayrollRunDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [payPeriodId, setPayPeriodId] = useState("");

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/runs?page=1&pageSize=100");
      setRuns(result.items);
    } catch {
      toast.error("Failed to load payroll runs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  async function handleGenerate() {
    if (!payPeriodId.trim()) {
      toast.error("Pay period ID is required");
      return;
    }

    setIsGenerating(true);
    try {
      await api("/api/payroll/runs/generate", {
        method: "POST",
        body: {
          runDate: new Date().toISOString().slice(0, 10),
          payPeriodId: payPeriodId.trim(),
        },
      });

      toast.success("Payroll run generated");
      setPayPeriodId("");
      fetchRuns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate payroll run");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll Runs</h1>
        <p className="text-muted-foreground">Generate payroll from approved time entries by pay period</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Payroll Run</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="w-full sm:w-96 space-y-2">
            <Label htmlFor="pay-period-id">Pay Period ID</Label>
            <Input
              id="pay-period-id"
              value={payPeriodId}
              onChange={(e) => setPayPeriodId(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="bg-amber-500 hover:bg-amber-600 text-white">
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton
              rows={8}
              headers={["Run Date", "Pay Period", "Status", "Employees", "Gross", "Actions"]}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run Date</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{run.runDate}</TableCell>
                    <TableCell className="font-mono text-xs">{run.payPeriodId}</TableCell>
                    <TableCell><Badge variant="secondary">{run.statusName}</Badge></TableCell>
                    <TableCell className="text-right">{run.employeeCount}</TableCell>
                    <TableCell className="text-right">${run.totalGross.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/payroll/runs/${run.id}`}>View</Link>
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
