"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

interface OwnerSOVDto {
  id: string;
  projectId: string;
  ownerContractId: string;
  name: string;
  originalContractAmount: number;
  approvedChangeOrderAmount: number;
  revisedContractAmount: number;
  totalScheduledValue: number;
  defaultRetainagePercent: number;
  status: string;
  lockedDate: string | null;
  notes: string | null;
  createdAt: string;
  lineItems: OwnerSOVLineItemDto[] | null;
}

interface OwnerSOVLineItemDto {
  id: string;
  itemNumber: string;
  description: string;
  sortOrder: number;
  originalValue: number;
  approvedChangeOrderValue: number;
  scheduledValue: number;
  retainagePercent: number | null;
  costCodeId: string | null;
  isFromChangeOrder: boolean;
  notes: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [contract, setContract] = useState<OwnerContractDto | null>(null);
  const [sov, setSov] = useState<OwnerSOVDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sovNotFound, setSovNotFound] = useState(false);

  const [addLineOpen, setAddLineOpen] = useState(false);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [lineForm, setLineForm] = useState({
    itemNumber: "",
    description: "",
    scheduledValue: "",
    retainagePercent: "",
  });

  const fetchContract = useCallback(async () => {
    try {
      const data = await api<OwnerContractDto>(`/api/owner-contracts/${contractId}`);
      setContract(data);
    } catch {
      toast.error("Failed to load contract");
    }
  }, [contractId]);

  const fetchSOV = useCallback(async () => {
    try {
      const data = await api<OwnerSOVDto>(`/api/owner-contracts/${contractId}/sov`);
      setSov(data);
      setSovNotFound(false);
    } catch {
      setSovNotFound(true);
    }
  }, [contractId]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchContract(), fetchSOV()]).finally(() => setIsLoading(false));
  }, [fetchContract, fetchSOV]);

  const handleCreateSOV = async () => {
    if (!contract) return;
    try {
      await api(`/api/owner-contracts/${contractId}/sov`, {
        method: "POST",
        body: { projectId: contract.projectId },
      });
      toast.success("Schedule of Values created");
      fetchSOV();
    } catch {
      toast.error("Failed to create SOV");
    }
  };

  const handleActivateSOV = async () => {
    if (!sov) return;
    try {
      await api(`/api/owner-contracts/sov/${sov.id}/activate`, { method: "POST" });
      toast.success("SOV activated");
      fetchSOV();
    } catch {
      toast.error("Failed to activate SOV. Ensure line items balance to contract amount.");
    }
  };

  const handleAddLine = async () => {
    if (!sov) return;
    setIsAddingLine(true);
    try {
      await api(`/api/owner-contracts/sov/${sov.id}/lines`, {
        method: "POST",
        body: {
          itemNumber: lineForm.itemNumber,
          description: lineForm.description,
          scheduledValue: parseFloat(lineForm.scheduledValue),
          retainagePercent: lineForm.retainagePercent ? parseFloat(lineForm.retainagePercent) : null,
        },
      });
      toast.success("Line item added");
      setAddLineOpen(false);
      setLineForm({ itemNumber: "", description: "", scheduledValue: "", retainagePercent: "" });
      fetchSOV();
    } catch {
      toast.error("Failed to add line item");
    } finally {
      setIsAddingLine(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    try {
      await api(`/api/owner-contracts/sov/lines/${lineId}`, { method: "DELETE" });
      toast.success("Line item deleted");
      fetchSOV();
    } catch {
      toast.error("Failed to delete line item");
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-64 animate-pulse rounded bg-muted" /></div>;
  }

  if (!contract) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Contract not found.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{contract.contractNumber}</h1>
          <p className="text-muted-foreground">{contract.projectName}</p>
        </div>
        <Badge>{contract.status}</Badge>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="sov">Schedule of Values</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Original Contract Sum</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(contract.originalContractSum)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Orders</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(contract.approvedChangeOrderAmount)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Contract Sum to Date</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(contract.contractSumToDate)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Retainage</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{contract.defaultRetainagePercent}%</p></CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><dt className="text-sm text-muted-foreground">Owner</dt><dd className="font-medium">{contract.ownerName || "—"}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Architect</dt><dd className="font-medium">{contract.architectName || "—"}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Contract Date</dt><dd className="font-medium">{contract.contractDate || "—"}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Payment Terms</dt><dd className="font-medium">{contract.paymentTermsDays} days</dd></div>
                <div><dt className="text-sm text-muted-foreground">Materials Retainage</dt><dd className="font-medium">{contract.retainagePercentMaterials}%</dd></div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sov">
          {sovNotFound ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No Schedule of Values has been created for this contract.</p>
                <Button onClick={handleCreateSOV}>Create SOV</Button>
              </CardContent>
            </Card>
          ) : sov ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{sov.name}</h2>
                  <Badge variant={sov.status === "Active" ? "default" : "secondary"}>{sov.status}</Badge>
                </div>
                <div className="flex gap-2">
                  {sov.status === "Draft" && (
                    <>
                      <Button variant="outline" onClick={() => setAddLineOpen(true)}>Add Line</Button>
                      <Button onClick={handleActivateSOV}>Activate SOV</Button>
                    </>
                  )}
                  {(sov.status === "Active" || sov.status === "Locked") && (
                    <Button onClick={() => router.push(`/billing/applications?contractId=${contractId}`)}>
                      View Applications
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revised Contract</CardTitle></CardHeader>
                  <CardContent><p className="text-lg font-bold">{formatCurrency(sov.revisedContractAmount)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Scheduled</CardTitle></CardHeader>
                  <CardContent><p className="text-lg font-bold">{formatCurrency(sov.totalScheduledValue)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Variance</CardTitle></CardHeader>
                  <CardContent>
                    <p className={`text-lg font-bold ${sov.revisedContractAmount - sov.totalScheduledValue !== 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(sov.revisedContractAmount - sov.totalScheduledValue)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {sov.lineItems && sov.lineItems.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Scheduled Value</TableHead>
                          <TableHead>Retainage</TableHead>
                          {sov.status === "Draft" && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sov.lineItems.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-mono">{line.itemNumber}</TableCell>
                            <TableCell>{line.description}</TableCell>
                            <TableCell>{formatCurrency(line.scheduledValue)}</TableCell>
                            <TableCell>{line.retainagePercent != null ? `${line.retainagePercent}%` : "Default"}</TableCell>
                            {sov.status === "Draft" && (
                              <TableCell>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteLine(line.id)}>Delete</Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No line items yet. Add line items to define the schedule of values.
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add SOV Line Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="lineItemNumber">Item Number</Label>
              <Input id="lineItemNumber" placeholder="e.g. 1, 2, 2A" value={lineForm.itemNumber} onChange={(e) => setLineForm({ ...lineForm, itemNumber: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lineDescription">Description</Label>
              <Input id="lineDescription" placeholder="e.g. General Conditions" value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lineValue">Scheduled Value</Label>
              <Input id="lineValue" type="number" step="0.01" value={lineForm.scheduledValue} onChange={(e) => setLineForm({ ...lineForm, scheduledValue: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lineRetainage">Retainage % (optional override)</Label>
              <Input id="lineRetainage" type="number" step="0.01" placeholder="Leave blank for default" value={lineForm.retainagePercent} onChange={(e) => setLineForm({ ...lineForm, retainagePercent: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineOpen(false)}>Cancel</Button>
            <LoadingButton loading={isAddingLine} onClick={handleAddLine} disabled={!lineForm.itemNumber || !lineForm.description || !lineForm.scheduledValue}>
              Add Line
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
