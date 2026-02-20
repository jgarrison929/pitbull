"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";

interface BillingApplicationDto {
  id: string;
  applicationNumber: number;
  periodFrom: string;
  periodThrough: string;
  applicationDate: string;
  originalContractSum: number;
  netChangeByChangeOrders: number;
  contractSumToDate: number;
  totalCompletedAndStoredToDate: number;
  retainageOnCompletedWork: number;
  retainageOnStoredMaterials: number;
  totalRetainage: number;
  retainagePercentWork: number;
  retainagePercentMaterials: number;
  totalEarnedLessRetainage: number;
  lessPreviousCertificates: number;
  currentPaymentDue: number;
  balanceToFinishIncludingRetainage: number;
  status: string;
  lineItems: BillingLineItemDto[] | null;
}

interface BillingLineItemDto {
  id: string;
  itemNumber: string;
  description: string;
  scheduledValue: number;
  sortOrder: number;
  workCompletedPrevious: number;
  workCompletedThisPeriod: number;
  materialsStoredToDate: number;
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;
  retainagePercent: number | null;
  retainageAmount: number;
}

interface LineEdit {
  lineItemId: string;
  workCompletedThisPeriod: string;
  materialsStoredToDate: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function G702Page() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<BillingApplicationDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});

  const fetchApp = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<BillingApplicationDto>(`/api/billing-applications/${appId}`);
      setApp(data);
      if (data.lineItems) {
        const initial: Record<string, LineEdit> = {};
        for (const line of data.lineItems) {
          initial[line.id] = {
            lineItemId: line.id,
            workCompletedThisPeriod: String(line.workCompletedThisPeriod),
            materialsStoredToDate: String(line.materialsStoredToDate),
          };
        }
        setEdits(initial);
      }
    } catch {
      toast.error("Failed to load billing application");
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => { fetchApp(); }, [fetchApp]);

  const updateEdit = (lineId: string, field: keyof Omit<LineEdit, "lineItemId">, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const lines = Object.values(edits).map((e) => ({
        lineItemId: e.lineItemId,
        workCompletedThisPeriod: parseFloat(e.workCompletedThisPeriod) || 0,
        materialsStoredToDate: parseFloat(e.materialsStoredToDate) || 0,
      }));

      await api(`/api/billing-applications/${appId}/lines`, {
        method: "PUT",
        body: { lines },
      });
      toast.success("Lines saved and G702 recalculated");
      fetchApp();
    } catch {
      toast.error("Failed to save line updates");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-96 animate-pulse rounded bg-muted" /></div>;
  }

  if (!app) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Application not found.</p></div>;
  }

  const isDraft = app.status === "Draft";
  const lines = app.lineItems || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">G702/G703 — Application #{app.applicationNumber}</h1>
          <p className="text-muted-foreground">Period: {app.periodFrom} — {app.periodThrough}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{app.status}</Badge>
          {isDraft && (
            <LoadingButton loading={isSaving} onClick={handleSave}>Save &amp; Recalculate</LoadingButton>
          )}
        </div>
      </div>

      {/* G702 Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Contract Sum to Date</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatCurrency(app.contractSumToDate)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Completed</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatCurrency(app.totalCompletedAndStoredToDate)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Retainage</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatCurrency(app.totalRetainage)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Current Payment Due</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold text-primary">{formatCurrency(app.currentPaymentDue)}</p></CardContent>
        </Card>
      </div>

      {/* G703 Continuation Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>G703 Continuation Sheet</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">A</TableHead>
                <TableHead className="min-w-[200px]">B — Description</TableHead>
                <TableHead className="text-right">C — Scheduled</TableHead>
                <TableHead className="text-right">D — Previous</TableHead>
                <TableHead className="text-right w-32">E — This Period</TableHead>
                <TableHead className="text-right w-32">F — Stored</TableHead>
                <TableHead className="text-right">G — Total</TableHead>
                <TableHead className="text-right w-16">H — %</TableHead>
                <TableHead className="text-right">I — Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const edit = edits[line.id];
                return (
                  <TableRow key={line.id}>
                    <TableCell className="text-center font-mono">{line.itemNumber}</TableCell>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(line.scheduledValue)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(line.workCompletedPrevious)}</TableCell>
                    <TableCell className="text-right">
                      {isDraft && edit ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28 text-right font-mono"
                          value={edit.workCompletedThisPeriod}
                          onChange={(e) => updateEdit(line.id, "workCompletedThisPeriod", e.target.value)}
                        />
                      ) : (
                        <span className="font-mono">{formatCurrency(line.workCompletedThisPeriod)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isDraft && edit ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28 text-right font-mono"
                          value={edit.materialsStoredToDate}
                          onChange={(e) => updateEdit(line.id, "materialsStoredToDate", e.target.value)}
                        />
                      ) : (
                        <span className="font-mono">{formatCurrency(line.materialsStoredToDate)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(line.totalCompletedAndStored)}</TableCell>
                    <TableCell className="text-right font-mono">{line.percentComplete.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(line.balanceToFinish)}</TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell></TableCell>
                <TableCell>Grand Total</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(lines.reduce((s, l) => s + l.scheduledValue, 0))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(lines.reduce((s, l) => s + l.workCompletedPrevious, 0))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(lines.reduce((s, l) => s + l.workCompletedThisPeriod, 0))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(lines.reduce((s, l) => s + l.materialsStoredToDate, 0))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(app.totalCompletedAndStoredToDate)}</TableCell>
                <TableCell className="text-right font-mono">
                  {app.contractSumToDate > 0 ? ((app.totalCompletedAndStoredToDate / app.contractSumToDate) * 100).toFixed(1) : "0.0"}%
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(lines.reduce((s, l) => s + l.balanceToFinish, 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* G702 Lines Detail */}
      <Card>
        <CardHeader><CardTitle>G702 Lines 1-9</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b"><span>1. Original Contract Sum</span><span className="font-mono">{formatCurrency(app.originalContractSum)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>2. Net Change by Change Orders</span><span className="font-mono">{formatCurrency(app.netChangeByChangeOrders)}</span></div>
            <div className="flex justify-between py-1 border-b font-medium"><span>3. Contract Sum to Date</span><span className="font-mono">{formatCurrency(app.contractSumToDate)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>4. Total Completed &amp; Stored</span><span className="font-mono">{formatCurrency(app.totalCompletedAndStoredToDate)}</span></div>
            <div className="flex justify-between py-1 pl-4"><span>5a. Retainage — Work ({app.retainagePercentWork}%)</span><span className="font-mono">{formatCurrency(app.retainageOnCompletedWork)}</span></div>
            <div className="flex justify-between py-1 border-b pl-4"><span>5b. Retainage — Materials ({app.retainagePercentMaterials}%)</span><span className="font-mono">{formatCurrency(app.retainageOnStoredMaterials)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>5. Total Retainage</span><span className="font-mono">{formatCurrency(app.totalRetainage)}</span></div>
            <div className="flex justify-between py-1 border-b font-medium"><span>6. Total Earned Less Retainage</span><span className="font-mono">{formatCurrency(app.totalEarnedLessRetainage)}</span></div>
            <div className="flex justify-between py-1 border-b"><span>7. Less Previous Certificates</span><span className="font-mono">{formatCurrency(app.lessPreviousCertificates)}</span></div>
            <div className="flex justify-between py-2 bg-muted/50 px-2 rounded font-bold text-base"><span>8. Current Payment Due</span><span className="font-mono">{formatCurrency(app.currentPaymentDue)}</span></div>
            <div className="flex justify-between py-1"><span>9. Balance to Finish Incl. Retainage</span><span className="font-mono">{formatCurrency(app.balanceToFinishIncludingRetainage)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
