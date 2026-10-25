"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TableSkeleton } from "@/components/skeletons";
import { Plus, Pencil, Trash2, Calculator, MapPin } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/use-require-admin";

interface TaxRateDto {
  id: string;
  category: string;
  rate: number;
  isActive: boolean;
  effectiveDate: string;
  expirationDate: string | null;
}

interface TaxJurisdiction {
  id: string;
  name: string;
  code: string;
  state: string | null;
  county: string | null;
  city: string | null;
  combinedRate: number;
  stateRate: number;
  countyRate: number;
  cityRate: number;
  isActive: boolean;
  effectiveDate: string;
  expirationDate: string | null;
  rates: TaxRateDto[];
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const TAX_CATEGORIES = ["Materials", "Labor", "Equipment", "Subcontract", "Other"];

function formatRate(rate: number) {
  return `${rate.toFixed(2)}%`;
}

export default function TaxSettingsPage() {
  const { isAdmin } = useRequireAdmin();
  const [jurisdictions, setJurisdictions] = useState<TaxJurisdiction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterState, setFilterState] = useState<string>("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [stateRate, setStateRate] = useState("");
  const [countyRate, setCountyRate] = useState("");
  const [cityRate, setCityRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  // Tax calculator
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcJurisdictionId, setCalcJurisdictionId] = useState("");
  const [calcAmount, setCalcAmount] = useState("");
  const [calcCategory, setCalcCategory] = useState("Materials");
  const [calcResult, setCalcResult] = useState<{ taxRate: number; taxAmount: number; isExempt: boolean } | null>(null);

  const fetchJurisdictions = useCallback(async () => {
    try {
      const qs = filterState ? `?state=${filterState}` : "";
      const res = await api<TaxJurisdiction[]>(`/api/tax-jurisdictions${qs}`);
      setJurisdictions(res);
    } catch {
      toast.error("Failed to load tax jurisdictions");
    } finally {
      setIsLoading(false);
    }
  }, [filterState]);

  useEffect(() => { fetchJurisdictions(); }, [fetchJurisdictions]);

  function resetForm() {
    setName(""); setCode(""); setState(""); setCounty(""); setCity("");
    setStateRate(""); setCountyRate(""); setCityRate("");
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setDialogOpen(true);
  }

  function openEdit(j: TaxJurisdiction) {
    setEditingId(j.id);
    setName(j.name);
    setCode(j.code);
    setState(j.state || "");
    setCounty(j.county || "");
    setCity(j.city || "");
    setStateRate(j.stateRate.toString());
    setCountyRate(j.countyRate.toString());
    setCityRate(j.cityRate.toString());
    setEffectiveDate(j.effectiveDate);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!code.trim()) { toast.error("Code is required"); return; }

    setIsSaving(true);
    try {
      if (editingId) {
        await api(`/api/tax-jurisdictions/${editingId}`, {
          method: "PUT",
          body: {
            name: name.trim(),
            code: code.trim(),
            state: state || null,
            county: county || null,
            city: city || null,
            stateRate: parseFloat(stateRate) || 0,
            countyRate: parseFloat(countyRate) || 0,
            cityRate: parseFloat(cityRate) || 0,
            effectiveDate: effectiveDate || null,
          },
        });
        toast.success("Jurisdiction updated");
      } else {
        await api("/api/tax-jurisdictions", {
          method: "POST",
          body: {
            name: name.trim(),
            code: code.trim(),
            state: state || null,
            county: county || null,
            city: city || null,
            stateRate: parseFloat(stateRate) || 0,
            countyRate: parseFloat(countyRate) || 0,
            cityRate: parseFloat(cityRate) || 0,
            effectiveDate: effectiveDate || null,
            expirationDate: null,
            rates: null,
          },
        });
        toast.success("Jurisdiction created");
      }
      setDialogOpen(false);
      resetForm();
      fetchJurisdictions();
    } catch {
      toast.error("Failed to save jurisdiction");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tax jurisdiction?")) return;
    try {
      await api(`/api/tax-jurisdictions/${id}`, { method: "DELETE" });
      toast.success("Jurisdiction deleted");
      fetchJurisdictions();
    } catch {
      toast.error("Failed to delete jurisdiction");
    }
  }

  async function handleCalculate() {
    if (!calcJurisdictionId || !calcAmount) {
      toast.error("Jurisdiction and amount are required");
      return;
    }
    try {
      const result = await api<{ taxRate: number; taxAmount: number; isExempt: boolean }>(
        "/api/tax-jurisdictions/calculate",
        {
          method: "POST",
          body: {
            jurisdictionId: calcJurisdictionId,
            amount: parseFloat(calcAmount),
            category: calcCategory,
          },
        }
      );
      setCalcResult(result);
    } catch {
      toast.error("Failed to calculate tax");
    }
  }

  if (!isAdmin) return null;

  const combinedRate = (parseFloat(stateRate) || 0) + (parseFloat(countyRate) || 0) + (parseFloat(cityRate) || 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Tax Settings" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Jurisdictions</h1>
          <p className="text-muted-foreground">
            Manage sales tax rates by state, county, and city
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCalcOpen(true)} className="min-h-[44px]">
            <Calculator className="h-4 w-4 mr-2" /> Tax Calculator
          </Button>
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" /> Add Jurisdiction
          </Button>
        </div>
      </div>

      {/* State filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Filter by State</Label>
            <Select value={filterState} onValueChange={(v) => setFilterState(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {jurisdictions.length} jurisdiction{jurisdictions.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Jurisdictions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Tax Jurisdictions
          </CardTitle>
          <CardDescription>
            Combined rate = state + county + city. Category-specific rates override the combined rate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton
              headers={["Name", "Code", "State", "County", "City", "State Rate", "County Rate", "City Rate", "Combined", "Status", "Actions"]}
              rows={5}
            />
          ) : jurisdictions.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No tax jurisdictions configured.</p>
              <Button variant="link" onClick={openCreate}>Add your first jurisdiction</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">State</TableHead>
                    <TableHead className="text-right">County</TableHead>
                    <TableHead className="text-right">City</TableHead>
                    <TableHead className="text-right">Combined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rates</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jurisdictions.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.name}</TableCell>
                      <TableCell className="font-mono text-sm">{j.code}</TableCell>
                      <TableCell className="text-sm">
                        {[j.city, j.county, j.state].filter(Boolean).join(", ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatRate(j.stateRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRate(j.countyRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRate(j.cityRate)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatRate(j.combinedRate)}</TableCell>
                      <TableCell>
                        {j.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {j.rates.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {j.rates.map((r) => `${r.category}: ${formatRate(r.rate)}`).join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uses combined</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(j)} title="Edit" aria-label={`Edit ${j.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(j.id)} title="Delete" aria-label={`Delete ${j.name}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Tax Jurisdiction</DialogTitle>
            <DialogDescription>
              Define tax rates for a specific geographic area
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input placeholder="e.g. Denver Metro" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input placeholder="e.g. CO-DENVER" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>County</Label>
                <Input placeholder="e.g. Denver" value={county} onChange={(e) => setCounty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input placeholder="e.g. Denver" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>State Rate (%)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={stateRate} onChange={(e) => setStateRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>County Rate (%)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={countyRate} onChange={(e) => setCountyRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>City Rate (%)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={cityRate} onChange={(e) => setCityRate(e.target.value)} />
              </div>
            </div>

            <div className="rounded-md bg-muted p-3 text-sm">
              Combined Rate: <span className="font-semibold">{formatRate(combinedRate)}</span>
            </div>

            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tax Calculator Dialog */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Tax Calculator
            </DialogTitle>
            <DialogDescription>
              Calculate tax for a specific amount and jurisdiction
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Jurisdiction</Label>
              <Select value={calcJurisdictionId} onValueChange={setCalcJurisdictionId}>
                <SelectTrigger><SelectValue placeholder="Select jurisdiction" /></SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name} ({formatRate(j.combinedRate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="1000.00" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={calcCategory} onValueChange={setCalcCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCalculate} className="w-full">Calculate</Button>
            {calcResult && (
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Rate</span>
                  <span className="font-medium">{formatRate(calcResult.taxRate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Amount</span>
                  <span className="font-semibold">${calcResult.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">
                    ${(parseFloat(calcAmount) + calcResult.taxAmount).toFixed(2)}
                  </span>
                </div>
                {calcResult.isExempt && (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    Tax Exempt
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
