"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

interface PayrollExportDto {
  id: string;
  payrollRunId: string;
  formatName: string;
  exportedAt: string;
  fileName: string;
  lineCount: number;
  totalGross: number;
  totalNet: number;
}

interface ListResult {
  items: PayrollExportDto[];
}

const formats = [
  { label: "CSV", value: "1" },
  { label: "ADP", value: "2" },
  { label: "Paychex", value: "3" },
  { label: "QuickBooks", value: "4" },
];

export default function PayrollExportsPage() {
  const [items, setItems] = useState<PayrollExportDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [payrollRunId, setPayrollRunId] = useState("");
  const [format, setFormat] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ListResult>("/api/payroll/exports?page=1&pageSize=100");
      setItems(result.items);
    } catch {
      toast.error("Failed to load payroll exports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function generateExport() {
    if (!payrollRunId.trim()) {
      toast.error("Payroll run ID is required");
      return;
    }

    setIsGenerating(true);
    try {
      await api("/api/payroll/exports/generate", {
        method: "POST",
        body: {
          payrollRunId: payrollRunId.trim(),
          format: Number(format),
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });

      toast.success("Payroll export generated");
      setIsDialogOpen(false);
      setPayrollRunId("");
      setStartDate("");
      setEndDate("");
      fetchItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate export");
    } finally {
      setIsGenerating(false);
    }
  }

  async function downloadExport(id: string) {
    try {
      const response = await fetch(`/api/payroll/exports/${id}/download`, {
        method: "GET",
        headers: { Accept: "text/csv" },
      });

      if (!response.ok) {
        throw new Error("Failed to download export");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.split("filename=")[1]?.replace(/\"/g, "") ?? "payroll-export.csv";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll Exports</h1>
          <p className="text-muted-foreground">Generate and download payroll processor exports</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white">Generate Export</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Payroll Export</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payrollRunId">Payroll Run ID</Label>
                <Input id="payrollRunId" value={payrollRunId} onChange={(e) => setPayrollRunId(e.target.value)} placeholder="uuid" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={generateExport} disabled={isGenerating} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Exported", "Payroll Run", "Format", "Lines", "Gross", "Net", "Status", "Actions"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exported</TableHead>
                  <TableHead>Payroll Run</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.exportedAt}</TableCell>
                    <TableCell className="font-mono text-xs">{item.payrollRunId}</TableCell>
                    <TableCell>{item.formatName}</TableCell>
                    <TableCell className="text-right">{item.lineCount}</TableCell>
                    <TableCell className="text-right">${item.totalGross.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${item.totalNet.toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary">Generated</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => downloadExport(item.id)}>
                        Download
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
