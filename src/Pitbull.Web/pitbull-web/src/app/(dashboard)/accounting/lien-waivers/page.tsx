"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

type WaiverType = "Conditional" | "Unconditional" | "Progress" | "Final";
type WaiverStatus = "Requested" | "Received" | "Approved" | "Rejected";

interface LienWaiverDto {
  id: string;
  projectId: string;
  vendorId: string | null;
  waiverType: WaiverType;
  amount: number;
  throughDate: string;
  status: WaiverStatus;
  documentPath: string | null;
  description: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface ListResult {
  items: LienWaiverDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusColors: Record<WaiverStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Requested: "outline",
  Received: "secondary",
  Approved: "default",
  Rejected: "destructive",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function LienWaiversPage() {
  const [waivers, setWaivers] = useState<LienWaiverDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [typeFilter, setTypeFilter] = useState(ALL_VALUE);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWaiver, setNewWaiver] = useState({
    projectId: "",
    vendorId: "",
    waiverType: "Conditional" as WaiverType,
    amount: "",
    throughDate: "",
    description: "",
  });

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectWaiver, setRejectWaiver] = useState<LienWaiverDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchWaivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
      if (typeFilter !== ALL_VALUE) params.set("waiverType", typeFilter);

      const data = await api<ListResult>(`/api/lien-waivers?${params}`);
      setWaivers(data.items);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Failed to load lien waivers");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { fetchWaivers(); }, [fetchWaivers]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await api("/api/lien-waivers", {
        method: "POST",
        body: {
          projectId: newWaiver.projectId,
          vendorId: newWaiver.vendorId || null,
          waiverType: newWaiver.waiverType,
          amount: parseFloat(newWaiver.amount),
          throughDate: newWaiver.throughDate,
          description: newWaiver.description || null,
        },
      });
      toast.success("Lien waiver created");
      setCreateDialogOpen(false);
      setNewWaiver({ projectId: "", vendorId: "", waiverType: "Conditional", amount: "", throughDate: "", description: "" });
      fetchWaivers();
    } catch {
      toast.error("Failed to create lien waiver");
    } finally {
      setIsCreating(false);
    }
  };

  const handleMarkReceived = async (id: string) => {
    try {
      await api(`/api/lien-waivers/${id}/receive`, { method: "POST", body: {} });
      toast.success("Waiver marked as received");
      fetchWaivers();
    } catch {
      toast.error("Failed to update waiver");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api(`/api/lien-waivers/${id}/approve`, { method: "POST" });
      toast.success("Waiver approved");
      fetchWaivers();
    } catch {
      toast.error("Failed to approve waiver");
    }
  };

  const handleReject = async () => {
    if (!rejectWaiver) return;
    setIsRejecting(true);
    try {
      await api(`/api/lien-waivers/${rejectWaiver.id}/reject`, {
        method: "POST",
        body: { reason: rejectReason },
      });
      toast.success("Waiver rejected");
      setRejectDialogOpen(false);
      setRejectReason("");
      fetchWaivers();
    } catch {
      toast.error("Failed to reject waiver");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/lien-waivers/${id}`, { method: "DELETE" });
      toast.success("Waiver deleted");
      fetchWaivers();
    } catch {
      toast.error("Failed to delete waiver");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lien Waivers</h1>
        <p className="text-muted-foreground">Track and manage lien waiver requests, receipts, and approvals. {totalCount > 0 && `${totalCount} total.`}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
            <SelectItem value="Requested">Requested</SelectItem>
            <SelectItem value="Received">Received</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Types</SelectItem>
            <SelectItem value="Conditional">Conditional</SelectItem>
            <SelectItem value="Unconditional">Unconditional</SelectItem>
            <SelectItem value="Progress">Progress</SelectItem>
            <SelectItem value="Final">Final</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={() => setCreateDialogOpen(true)}>New Waiver</Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} headers={["Through Date", "Type", "Amount", "Status", "Description", "Reviewed"]} />
      ) : waivers.length === 0 ? (
        <EmptyState title="No lien waivers" description="Create a lien waiver request to start tracking compliance." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Through Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waivers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{new Date(w.throughDate + "T00:00:00").toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="outline">{w.waiverType}</Badge></TableCell>
                    <TableCell>{formatCurrency(w.amount)}</TableCell>
                    <TableCell><Badge variant={statusColors[w.status]}>{w.status}</Badge></TableCell>
                    <TableCell className="max-w-48 truncate">{w.description || "—"}</TableCell>
                    <TableCell>{w.reviewedAt ? new Date(w.reviewedAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {w.status === "Requested" && (
                          <Button variant="outline" size="sm" onClick={() => handleMarkReceived(w.id)}>Receive</Button>
                        )}
                        {w.status === "Received" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleApprove(w.id)}>Approve</Button>
                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => {
                              setRejectWaiver(w);
                              setRejectDialogOpen(true);
                            }}>Reject</Button>
                          </>
                        )}
                        {w.status !== "Approved" && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(w.id)}>Delete</Button>
                        )}
                      </div>
                    </TableCell>
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

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Lien Waiver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="waiverProjectId">Project ID</Label>
              <Input id="waiverProjectId" placeholder="Enter project ID" value={newWaiver.projectId} onChange={(e) => setNewWaiver({ ...newWaiver, projectId: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="waiverVendorId">Vendor ID (optional)</Label>
              <Input id="waiverVendorId" placeholder="Enter vendor ID" value={newWaiver.vendorId} onChange={(e) => setNewWaiver({ ...newWaiver, vendorId: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="waiverType">Waiver Type</Label>
              <Select value={newWaiver.waiverType} onValueChange={(v) => setNewWaiver({ ...newWaiver, waiverType: v as WaiverType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conditional">Conditional</SelectItem>
                  <SelectItem value="Unconditional">Unconditional</SelectItem>
                  <SelectItem value="Progress">Progress</SelectItem>
                  <SelectItem value="Final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="waiverAmount">Amount</Label>
              <Input id="waiverAmount" type="number" step="0.01" value={newWaiver.amount} onChange={(e) => setNewWaiver({ ...newWaiver, amount: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="waiverDate">Through Date</Label>
              <Input id="waiverDate" type="date" value={newWaiver.throughDate} onChange={(e) => setNewWaiver({ ...newWaiver, throughDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="waiverDescription">Description</Label>
              <Input id="waiverDescription" value={newWaiver.description} onChange={(e) => setNewWaiver({ ...newWaiver, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isCreating} onClick={handleCreate} disabled={!newWaiver.projectId || !newWaiver.amount || !newWaiver.throughDate}>
              Create
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Lien Waiver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rejectReason">Reason for Rejection</Label>
              <Textarea id="rejectReason" placeholder="Explain why this waiver is being rejected..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <LoadingButton loading={isRejecting} onClick={handleReject} disabled={!rejectReason.trim()} variant="destructive">
              Reject
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
