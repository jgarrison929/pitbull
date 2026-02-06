"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers, Wrench, Package, Truck, Users, HelpCircle } from "lucide-react";
import api from "@/lib/api";
import type { CostCode, CostType } from "@/lib/types";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

interface ListCostCodesResult {
  items: CostCode[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const costTypeLabels: Record<CostType, string> = {
  1: "Labor",
  2: "Material",
  3: "Equipment",
  4: "Subcontract",
  5: "Other",
};

const costTypeBadgeClass: Record<CostType, string> = {
  1: "bg-blue-100 text-blue-800",
  2: "bg-green-100 text-green-800",
  3: "bg-amber-100 text-amber-800",
  4: "bg-purple-100 text-purple-800",
  5: "bg-gray-100 text-gray-800",
};

const costTypeIcons: Record<CostType, React.ComponentType<{ className?: string }>> = {
  1: Users,
  2: Package,
  3: Truck,
  4: Wrench,
  5: HelpCircle,
};

export default function CostCodesPage() {
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [costTypeFilter, setCostTypeFilter] = useState<string>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<string>("true");

  const fetchCostCodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      if (search.trim()) params.set("search", search.trim());
      if (costTypeFilter !== ALL_VALUE)
        params.set("costType", costTypeFilter);
      if (activeFilter !== ALL_VALUE)
        params.set("isActive", activeFilter);

      const result = await api<ListCostCodesResult>(
        `/api/cost-codes?${params.toString()}`
      );
      setCostCodes(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load cost codes");
    } finally {
      setIsLoading(false);
    }
  }, [search, costTypeFilter, activeFilter]);

  useEffect(() => {
    fetchCostCodes();
  }, [fetchCostCodes]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCostCodes();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Summary stats
  const laborCount = costCodes.filter((c) => c.costType === 1).length;
  const materialCount = costCodes.filter((c) => c.costType === 2).length;
  const equipmentCount = costCodes.filter((c) => c.costType === 3).length;
  const subcontractCount = costCodes.filter((c) => c.costType === 4).length;
  const activeCount = costCodes.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost Codes</h1>
          <p className="text-muted-foreground">
            Standard construction cost codes for job cost accounting
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">{activeCount} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Labor</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{laborCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Material</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipment</CardTitle>
            <Truck className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipmentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subcontract</CardTitle>
            <Wrench className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subcontractCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by code or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costType">Cost Type</Label>
              <Select
                value={costTypeFilter}
                onValueChange={setCostTypeFilter}
              >
                <SelectTrigger id="costType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All types</SelectItem>
                  <SelectItem value="1">Labor</SelectItem>
                  <SelectItem value="2">Material</SelectItem>
                  <SelectItem value="3">Equipment</SelectItem>
                  <SelectItem value="4">Subcontract</SelectItem>
                  <SelectItem value="5">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="active">Status</Label>
              <Select
                value={activeFilter}
                onValueChange={setActiveFilter}
              >
                <SelectTrigger id="active">
                  <SelectValue placeholder="Active only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active only</SelectItem>
                  <SelectItem value="false">Inactive only</SelectItem>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table (Desktop) */}
      <div className="hidden md:block">
        {isLoading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : costCodes.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-12 w-12 text-muted-foreground" />}
            title="No cost codes found"
            description="No cost codes match your filters. Try adjusting your search criteria."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCodes.map((code) => {
                  const TypeIcon = costTypeIcons[code.costType] || HelpCircle;
                  return (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-medium">
                        {code.code}
                      </TableCell>
                      <TableCell>{code.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {code.division || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={costTypeBadgeClass[code.costType]}
                        >
                          <TypeIcon className="mr-1 h-3 w-3" />
                          {costTypeLabels[code.costType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={code.isActive ? "default" : "secondary"}
                          className={
                            code.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {code.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Card List (Mobile) */}
      <div className="md:hidden">
        {isLoading ? (
          <CardListSkeleton count={5} />
        ) : costCodes.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-12 w-12 text-muted-foreground" />}
            title="No cost codes found"
            description="No cost codes match your filters."
          />
        ) : (
          <div className="space-y-3">
            {costCodes.map((code) => {
              const TypeIcon = costTypeIcons[code.costType] || HelpCircle;
              return (
                <Card key={code.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-mono font-semibold">{code.code}</p>
                        <p className="text-sm">{code.description}</p>
                        {code.division && (
                          <p className="text-xs text-muted-foreground">
                            Division: {code.division}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant="secondary"
                          className={costTypeBadgeClass[code.costType]}
                        >
                          <TypeIcon className="mr-1 h-3 w-3" />
                          {costTypeLabels[code.costType]}
                        </Badge>
                        <Badge
                          variant={code.isActive ? "default" : "secondary"}
                          className={
                            code.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {code.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination info */}
      {!isLoading && costCodes.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {costCodes.length} of {totalCount} cost codes
        </div>
      )}
    </div>
  );
}
