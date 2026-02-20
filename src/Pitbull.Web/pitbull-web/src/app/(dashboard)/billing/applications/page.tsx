"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

type AppStatus = "Draft" | "PmReview" | "PmRejected" | "ReadyToSubmit" | "SubmittedToOwner" | "Disputed" | "ArchitectCertified" | "PaymentDue" | "PartiallyPaid" | "Paid" | "Void";

interface BillingApplicationDto {
  id: string;
  projectId: string;
  ownerContractId: string;
  ownerScheduleOfValuesId: string;
  applicationNumber: number;
  periodFrom: string;
  periodThrough: string;
  applicationDate: string;
  originalContractSum: number;
  contractSumToDate: number;
  totalCompletedAndStoredToDate: number;
  totalRetainage: number;
  totalEarnedLessRetainage: number;
  currentPaymentDue: number;
  balanceToFinishIncludingRetainage: number;
  status: AppStatus;
  createdAt: string;
}

interface ApplicationsResult {
  items: BillingApplicationDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusColors: Record<AppStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Draft: "outline",
  PmReview: "secondary",
  PmRejected: "destructive",
  ReadyToSubmit: "secondary",
  SubmittedToOwner: "default",
  Disputed: "destructive",
  ArchitectCertified: "default",
  PaymentDue: "default",
  PartiallyPaid: "secondary",
  Paid: "default",
  Void: "destructive",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function BillingApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contractIdParam = searchParams.get("contractId");

  const [apps, setApps] = useState<BillingApplicationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    ownerContractId: contractIdParam || "",
    ownerScheduleOfValuesId: "",
    periodFrom: "",
    periodThrough: "",
    applicationDate: "",
  });

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (contractIdParam) params.set("ownerContractId", contractIdParam);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

      const data = await api<ApplicationsResult>(`/api/billing-applications?${params}`);
      setApps(data.items);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Failed to load billing applications");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, contractIdParam]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const result = await api<BillingApplicationDto>("/api/billing-applications", {
        method: "POST",
        body: {
          ownerContractId: form.ownerContractId,
          ownerScheduleOfValuesId: form.ownerScheduleOfValuesId,
          periodFrom: form.periodFrom,
          periodThrough: form.periodThrough,
          applicationDate: form.applicationDate,
        },
      });
      toast.success(`Application #${result.applicationNumber} created`);
      setCreateDialogOpen(false);
      router.push(`/billing/applications/${result.id}`);
    } catch {
      toast.error("Failed to create billing application");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Applications</h1>
        <p className="text-muted-foreground">AIA G702 Applications and Certificates for Payment.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="PmReview">PM Review</SelectItem>
            <SelectItem value="ReadyToSubmit">Ready to Submit</SelectItem>
            <SelectItem value="SubmittedToOwner">Submitted</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Void">Void</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateDialogOpen(true)}>New Application</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} headers={["App #", "Period", "Contract Sum", "Completed", "Retainage", "Payment Due", "Status"]} />
      ) : apps.length === 0 ? (
        <EmptyState title="No billing applications" description="Create a billing application from an active owner contract." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Contract Sum</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Retainage</TableHead>
                  <TableHead>Payment Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/billing/applications/${a.id}`)}>
                    <TableCell className="font-bold">#{a.applicationNumber}</TableCell>
                    <TableCell>{a.periodFrom} — {a.periodThrough}</TableCell>
                    <TableCell>{formatCurrency(a.contractSumToDate)}</TableCell>
                    <TableCell>{formatCurrency(a.totalCompletedAndStoredToDate)}</TableCell>
                    <TableCell>{formatCurrency(a.totalRetainage)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(a.currentPaymentDue)}</TableCell>
                    <TableCell><Badge variant={statusColors[a.status]}>{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Billing Application</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="contractIdField">Owner Contract ID</Label>
              <Input id="contractIdField" value={form.ownerContractId} onChange={(e) => setForm({ ...form, ownerContractId: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sovIdField">SOV ID</Label>
              <Input id="sovIdField" value={form.ownerScheduleOfValuesId} onChange={(e) => setForm({ ...form, ownerScheduleOfValuesId: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodFrom">Period From</Label>
                <Input id="periodFrom" type="date" value={form.periodFrom} onChange={(e) => setForm({ ...form, periodFrom: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="periodThrough">Period Through</Label>
                <Input id="periodThrough" type="date" value={form.periodThrough} onChange={(e) => setForm({ ...form, periodThrough: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="appDate">Application Date</Label>
              <Input id="appDate" type="date" value={form.applicationDate} onChange={(e) => setForm({ ...form, applicationDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isCreating} onClick={handleCreate} disabled={!form.ownerContractId || !form.ownerScheduleOfValuesId || !form.periodFrom || !form.periodThrough}>
              Create
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
