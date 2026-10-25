"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

type ContractStatus = "Active" | "Closed" | "Void";

interface OwnerContractDto {
  id: string;
  projectId: string;
  contractNumber: string;
  projectName: string;
  ownerName: string | null;
  architectName: string | null;
  originalContractSum: number;
  approvedChangeOrderAmount: number;
  contractSumToDate: number;
  defaultRetainagePercent: number;
  retainagePercentMaterials: number;
  contractDate: string | null;
  paymentTermsDays: number;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string | null;
}

interface ContractsResult {
  items: OwnerContractDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusColors: Record<ContractStatus, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Closed: "secondary",
  Void: "destructive",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function OwnerContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<OwnerContractDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    contractNumber: "",
    projectName: "",
    originalContractSum: "",
    ownerName: "",
    architectName: "",
    defaultRetainagePercent: "10",
  });

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

      const data = await api<ContractsResult>(`/api/owner-contracts?${params}`);
      setContracts(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      toast.error("Failed to load owner contracts");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await api("/api/owner-contracts", {
        method: "POST",
        body: {
          projectId: form.projectId,
          contractNumber: form.contractNumber,
          projectName: form.projectName,
          originalContractSum: parseFloat(form.originalContractSum),
          ownerName: form.ownerName || null,
          architectName: form.architectName || null,
          defaultRetainagePercent: parseFloat(form.defaultRetainagePercent),
        },
      });
      toast.success("Owner contract created");
      setCreateDialogOpen(false);
      setForm({ projectId: "", contractNumber: "", projectName: "", originalContractSum: "", ownerName: "", architectName: "", defaultRetainagePercent: "10" });
      fetchContracts();
    } catch {
      toast.error("Failed to create contract");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner Contracts</h1>
        <p className="text-muted-foreground">Manage contracts with project owners for AIA billing.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Contracts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Contract Value</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(contracts.reduce((sum, c) => sum + c.contractSumToDate, 0))}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{contracts.filter(c => c.status === "Active").length}</p></CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48 min-h-[44px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
            <SelectItem value="Void">Void</SelectItem>
          </SelectContent>
        </Select>
        <Button className="min-h-[44px] w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)}>New Contract</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} headers={["Contract #", "Project", "Owner", "Contract Sum", "Retainage", "Status"]} />
      ) : contracts.length === 0 ? (
        <EmptyState title="No owner contracts" description="Create an owner contract to begin AIA billing." />
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {contracts.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full rounded-lg border bg-card p-4 text-left shadow-sm active:bg-muted/50 touch-manipulation min-h-[44px]"
                onClick={() => router.push(`/billing/contracts/${c.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium truncate">{c.contractNumber}</span>
                  <Badge variant={statusColors[c.status]}>{c.status}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium truncate">{c.projectName}</p>
                <p className="text-xs text-muted-foreground truncate">{c.ownerName || "No owner listed"}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Contract sum</p>
                    <p className="font-semibold">{formatCurrency(c.contractSumToDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Retainage</p>
                    <p>{c.defaultRetainagePercent}%</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Contract Sum</TableHead>
                      <TableHead>Retainage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/billing/contracts/${c.id}`)}>
                        <TableCell className="font-medium">{c.contractNumber}</TableCell>
                        <TableCell>{c.projectName}</TableCell>
                        <TableCell>{c.ownerName || "—"}</TableCell>
                        <TableCell>{formatCurrency(c.contractSumToDate)}</TableCell>
                        <TableCell>{c.defaultRetainagePercent}%</TableCell>
                        <TableCell><Badge variant={statusColors[c.status]}>{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
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
          <DialogHeader><DialogTitle>New Owner Contract</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="projectId">Project ID</Label>
              <Input id="projectId" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="contractNumber">Contract Number</Label>
              <Input id="contractNumber" value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input id="projectName" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="contractSum">Original Contract Sum</Label>
              <Input id="contractSum" type="number" step="0.01" value={form.originalContractSum} onChange={(e) => setForm({ ...form, originalContractSum: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ownerName">Owner Name</Label>
                <Input id="ownerName" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="retainage">Retainage %</Label>
                <Input id="retainage" type="number" step="0.01" value={form.defaultRetainagePercent} onChange={(e) => setForm({ ...form, defaultRetainagePercent: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isCreating} onClick={handleCreate} disabled={!form.contractNumber || !form.projectName || !form.originalContractSum}>
              Create
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
