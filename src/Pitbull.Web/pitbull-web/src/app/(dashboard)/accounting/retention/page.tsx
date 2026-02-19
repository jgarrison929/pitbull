"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

type HoldStatus = "Held" | "PartiallyReleased" | "Released";

interface RetentionPolicyDto {
  id: string;
  name: string;
  percentageRate: number;
  maxAmount: number | null;
  releaseThreshold: number | null;
  appliesTo: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface RetentionHoldDto {
  id: string;
  projectId: string;
  contractId: string | null;
  originalAmount: number;
  retainedAmount: number;
  releasedAmount: number;
  status: HoldStatus;
  retentionPolicyId: string | null;
  retainagePercent: number;
  description: string | null;
  effectiveDate: string;
  releasedByUserId: string | null;
  releasedAt: string | null;
  createdAt: string;
}

interface PoliciesResult {
  items: RetentionPolicyDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface HoldsResult {
  items: RetentionHoldDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRetained: number;
  totalReleased: number;
}

const holdStatusColors: Record<HoldStatus, "default" | "secondary" | "destructive"> = {
  Held: "default",
  PartiallyReleased: "secondary",
  Released: "destructive",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function RetentionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Retention Management</h1>
        <p className="text-muted-foreground">Manage retention policies and track retention holds across projects.</p>
      </div>

      <Tabs defaultValue="holds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holds">Retention Holds</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>
        <TabsContent value="holds"><HoldsTab /></TabsContent>
        <TabsContent value="policies"><PoliciesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Holds Tab ──

function HoldsTab() {
  const [holds, setHolds] = useState<RetentionHoldDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRetained, setTotalRetained] = useState(0);
  const [totalReleased, setTotalReleased] = useState(0);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);

  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [releaseHold, setReleaseHold] = useState<RetentionHoldDto | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [isReleasing, setIsReleasing] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newHold, setNewHold] = useState({
    projectId: "",
    originalAmount: "",
    retainagePercent: "10",
    description: "",
  });

  const fetchHolds = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

      const data = await api<HoldsResult>(`/api/retention/holds?${params}`);
      setHolds(data.items);
      setTotalPages(data.totalPages);
      setTotalRetained(data.totalRetained);
      setTotalReleased(data.totalReleased);
    } catch {
      toast.error("Failed to load retention holds");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchHolds(); }, [fetchHolds]);

  const handleRelease = async () => {
    if (!releaseHold) return;
    setIsReleasing(true);
    try {
      await api(`/api/retention/holds/${releaseHold.id}/release`, {
        method: "POST",
        body: { releaseAmount: parseFloat(releaseAmount) },
      });
      toast.success("Retention released successfully");
      setReleaseDialogOpen(false);
      setReleaseAmount("");
      fetchHolds();
    } catch {
      toast.error("Failed to release retention");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await api("/api/retention/holds", {
        method: "POST",
        body: {
          projectId: newHold.projectId,
          originalAmount: parseFloat(newHold.originalAmount),
          retainagePercent: parseFloat(newHold.retainagePercent),
          description: newHold.description || null,
        },
      });
      toast.success("Retention hold created");
      setCreateDialogOpen(false);
      setNewHold({ projectId: "", originalAmount: "", retainagePercent: "10", description: "" });
      fetchHolds();
    } catch {
      toast.error("Failed to create retention hold");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Retained</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalRetained)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Released</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalReleased)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalRetained - totalReleased)}</p></CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
            <SelectItem value="Held">Held</SelectItem>
            <SelectItem value="PartiallyReleased">Partially Released</SelectItem>
            <SelectItem value="Released">Released</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateDialogOpen(true)}>New Hold</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} headers={["Effective Date", "Original Amount", "Retained", "Released", "Rate", "Status"]} />
      ) : holds.length === 0 ? (
        <EmptyState title="No retention holds" description="Create a retention hold to start tracking retainage." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Original Amount</TableHead>
                  <TableHead>Retained</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holds.map((h) => {
                  const remaining = h.retainedAmount - h.releasedAmount;
                  return (
                    <TableRow key={h.id}>
                      <TableCell>{h.effectiveDate}</TableCell>
                      <TableCell>{formatCurrency(h.originalAmount)}</TableCell>
                      <TableCell>{formatCurrency(h.retainedAmount)}</TableCell>
                      <TableCell>{formatCurrency(h.releasedAmount)}</TableCell>
                      <TableCell>{h.retainagePercent}%</TableCell>
                      <TableCell><Badge variant={holdStatusColors[h.status]}>{h.status}</Badge></TableCell>
                      <TableCell>
                        {h.status !== "Released" && (
                          <Button variant="outline" size="sm" onClick={() => {
                            setReleaseHold(h);
                            setReleaseAmount(String(remaining));
                            setReleaseDialogOpen(true);
                          }}>
                            Release
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      {/* Release Dialog */}
      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Release Retention</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Remaining: {releaseHold ? formatCurrency(releaseHold.retainedAmount - releaseHold.releasedAmount) : "—"}
            </p>
            <div>
              <Label htmlFor="releaseAmount">Release Amount</Label>
              <Input id="releaseAmount" type="number" step="0.01" value={releaseAmount} onChange={(e) => setReleaseAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isReleasing} onClick={handleRelease} disabled={!releaseAmount || parseFloat(releaseAmount) <= 0}>
              Release
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Hold Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Retention Hold</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="projectId">Project ID</Label>
              <Input id="projectId" placeholder="Enter project ID" value={newHold.projectId} onChange={(e) => setNewHold({ ...newHold, projectId: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="originalAmount">Original Amount</Label>
              <Input id="originalAmount" type="number" step="0.01" value={newHold.originalAmount} onChange={(e) => setNewHold({ ...newHold, originalAmount: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="retainagePercent">Retainage %</Label>
              <Input id="retainagePercent" type="number" step="0.01" value={newHold.retainagePercent} onChange={(e) => setNewHold({ ...newHold, retainagePercent: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="holdDescription">Description</Label>
              <Input id="holdDescription" value={newHold.description} onChange={(e) => setNewHold({ ...newHold, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isCreating} onClick={handleCreate} disabled={!newHold.projectId || !newHold.originalAmount}>
              Create
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Policies Tab ──

function PoliciesTab() {
  const [policies, setPolicies] = useState<RetentionPolicyDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    percentageRate: "10",
    maxAmount: "",
    appliesTo: "Both",
    isDefault: false,
  });

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<PoliciesResult>("/api/retention/policies?pageSize=100");
      setPolicies(data.items);
    } catch {
      toast.error("Failed to load retention policies");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await api("/api/retention/policies", {
        method: "POST",
        body: {
          name: newPolicy.name,
          percentageRate: parseFloat(newPolicy.percentageRate),
          maxAmount: newPolicy.maxAmount ? parseFloat(newPolicy.maxAmount) : null,
          appliesTo: newPolicy.appliesTo,
          isDefault: newPolicy.isDefault,
        },
      });
      toast.success("Policy created");
      setCreateDialogOpen(false);
      setNewPolicy({ name: "", percentageRate: "10", maxAmount: "", appliesTo: "Both", isDefault: false });
      fetchPolicies();
    } catch {
      toast.error("Failed to create policy");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/retention/policies/${id}`, { method: "DELETE" });
      toast.success("Policy deleted");
      fetchPolicies();
    } catch {
      toast.error("Failed to delete policy");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>New Policy</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} headers={["Name", "Rate", "Max Amount", "Applies To", "Status"]} />
      ) : policies.length === 0 ? (
        <EmptyState title="No retention policies" description="Create a policy to define standard retainage rates." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Max Amount</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                    </TableCell>
                    <TableCell>{p.percentageRate}%</TableCell>
                    <TableCell>{p.maxAmount ? formatCurrency(p.maxAmount) : "—"}</TableCell>
                    <TableCell>{p.appliesTo}</TableCell>
                    <TableCell><Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Policy Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Retention Policy</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="policyName">Name</Label>
              <Input id="policyName" value={newPolicy.name} onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="policyRate">Percentage Rate</Label>
              <Input id="policyRate" type="number" step="0.01" value={newPolicy.percentageRate} onChange={(e) => setNewPolicy({ ...newPolicy, percentageRate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="policyMax">Max Amount (optional)</Label>
              <Input id="policyMax" type="number" step="0.01" value={newPolicy.maxAmount} onChange={(e) => setNewPolicy({ ...newPolicy, maxAmount: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="policyAppliesTo">Applies To</Label>
              <Select value={newPolicy.appliesTo} onValueChange={(v) => setNewPolicy({ ...newPolicy, appliesTo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Both">Both</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="ChangeOrder">Change Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isCreating} onClick={handleCreate} disabled={!newPolicy.name || !newPolicy.percentageRate}>
              Create
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
