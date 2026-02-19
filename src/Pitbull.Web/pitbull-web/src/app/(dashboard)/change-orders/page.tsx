"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, DollarSign, Clock, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Subcontract, ChangeOrder } from "@/lib/types";
import { ChangeOrderStatus } from "@/lib/types";
import {
  changeOrderStatusBadgeClass,
  changeOrderStatusLabel,
  formatCurrency,
} from "@/lib/contracts";
import { toast } from "sonner";
import { ChangeOrderDialog } from "@/components/contracts/change-order-dialog";
import { useCompany } from "@/contexts/company-context";

const ALL_VALUE = "__all__";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleDateString();
}

export default function ChangeOrdersPage() {
  const { activeCompany } = useCompany();
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [subcontractFilter, setSubcontractFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [search, setSearch] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  const fetchSubcontracts = useCallback(async () => {
    try {
      const result = await api<PagedResult<Subcontract>>("/api/subcontracts?pageSize=100");
      setSubcontracts(result.items);
    } catch {
      // silently handle
    }
  }, []);

  const fetchChangeOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "50");
      if (subcontractFilter !== ALL_VALUE) params.set("subcontractId", subcontractFilter);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const result = await api<PagedResult<ChangeOrder>>(
        `/api/changeorders?${params.toString()}`
      );
      setChangeOrders(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load change orders");
    } finally {
      setIsLoading(false);
    }
  }, [subcontractFilter, statusFilter, search]);

  useEffect(() => {
    fetchSubcontracts();
  }, [fetchSubcontracts, activeCompany?.id]);

  useEffect(() => {
    fetchChangeOrders();
  }, [fetchChangeOrders, activeCompany?.id]);

  // Summary calculations
  const totalAmount = changeOrders.reduce((sum, co) => sum + co.amount, 0);
  const approvedAmount = changeOrders
    .filter((co) => co.status === ChangeOrderStatus.Approved)
    .reduce((sum, co) => sum + co.amount, 0);
  const pendingCount = changeOrders.filter(
    (co) => co.status === ChangeOrderStatus.Pending || co.status === ChangeOrderStatus.UnderReview
  ).length;
  const totalDays = changeOrders
    .filter((co) => co.status === ChangeOrderStatus.Approved)
    .reduce((sum, co) => sum + (co.daysExtension || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Change Orders</h1>
          <p className="text-muted-foreground">
            Track scope changes and cost impacts across all subcontracts
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          + New Change Order
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Change Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Impact</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${approvedAmount >= 0 ? "text-red-600" : "text-green-600"}`}>
              {approvedAmount >= 0 ? "+" : ""}{formatCurrency(approvedAmount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule Impact</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalDays > 0 ? `+${totalDays}` : totalDays} days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="subcontractFilter">Subcontract</Label>
              <Select value={subcontractFilter} onValueChange={setSubcontractFilter}>
                <SelectTrigger id="subcontractFilter">
                  <SelectValue placeholder="All subcontracts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Subcontracts</SelectItem>
                  {subcontracts.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.subcontractNumber} - {sub.subcontractorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="UnderReview">Under Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or CO number..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Change Orders</CardTitle>
          <CardDescription>{totalCount} total</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={5} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["CO #", "Title", "Amount", "Days", "Status", "Submitted"]}
                  rows={5}
                />
              </div>
            </>
          ) : changeOrders.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No change orders"
              description="Create your first change order to start tracking scope modifications."
              actionLabel="+ Create Change Order"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {changeOrders.map((co) => (
                  <div key={co.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{co.title}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {co.changeOrderNumber}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${changeOrderStatusBadgeClass(co.status)} text-xs shrink-0`}
                      >
                        {changeOrderStatusLabel(co.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Amount</span>
                        <p className={`font-medium font-mono ${co.amount >= 0 ? "text-red-600" : "text-green-600"}`}>
                          {co.amount >= 0 ? "+" : ""}{formatCurrency(co.amount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Days</span>
                        <p className="font-medium">
                          {co.daysExtension ? `+${co.daysExtension}` : "\u2014"}
                        </p>
                      </div>
                    </div>
                    {co.reason && (
                      <p className="text-xs text-muted-foreground">
                        Reason: {co.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CO #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeOrders.map((co) => (
                      <TableRow key={co.id}>
                        <TableCell className="font-mono text-sm">
                          {co.changeOrderNumber}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {co.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {co.reason || "\u2014"}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${co.amount >= 0 ? "text-red-600" : "text-green-600"}`}>
                          {co.amount >= 0 ? "+" : ""}{formatCurrency(co.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {co.daysExtension ? `+${co.daysExtension}` : "\u2014"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={changeOrderStatusBadgeClass(co.status)}
                          >
                            {changeOrderStatusLabel(co.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(co.submittedDate)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell className={`text-right font-mono ${totalAmount >= 0 ? "text-red-600" : "text-green-600"}`}>
                        {totalAmount >= 0 ? "+" : ""}{formatCurrency(totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalDays > 0 ? `+${totalDays}` : totalDays}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <ChangeOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => fetchChangeOrders()}
      />
    </div>
  );
}
