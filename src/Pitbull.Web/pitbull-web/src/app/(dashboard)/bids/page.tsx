"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { useNewShortcut } from "@/hooks/use-page-shortcuts";
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
import { FileText } from "lucide-react";
import api from "@/lib/api";
import { BidStatus, type PagedResult, type Bid } from "@/lib/types";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

const ALL_VALUE = "__all__";

function statusColor(status: BidStatus) {
  switch (status) {
    case BidStatus.Submitted:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100";
    case BidStatus.Draft:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case BidStatus.Won:
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100";
    case BidStatus.Lost:
      return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100";
    case BidStatus.NoResponse:
      return "bg-neutral-100 text-neutral-500 hover:bg-neutral-100";
    case BidStatus.Cancelled:
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    default:
      return "";
  }
}

function statusLabel(status: BidStatus) {
  switch (status) {
    case BidStatus.Draft:
      return "Draft";
    case BidStatus.Submitted:
      return "Submitted";
    case BidStatus.Won:
      return "Won";
    case BidStatus.Lost:
      return "Lost";
    case BidStatus.NoResponse:
      return "No Response";
    case BidStatus.Cancelled:
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function BidsPage() {
  const { activeCompany } = useCompany();
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  
  // Register "n" shortcut to create new bid
  useNewShortcut("/bids/new");

  useEffect(() => {
    async function fetchBids() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "50");
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
        const result = await api<PagedResult<Bid>>(
          `/api/bids?${params.toString()}`
        );
        setBids(result.items);
      } catch {
        toast.error("Failed to load bids");
      } finally {
        setIsLoading(false);
      }
    }
    const timer = setTimeout(fetchBids, 250);
    return () => clearTimeout(timer);
    // Re-fetch when the active company changes
  }, [activeCompany?.id, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bids</h1>
          <p className="text-muted-foreground">
            Track and manage bid proposals
          </p>
        </div>
        <Button
          asChild
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          <Link href="/bids/new">+ New Bid</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bid-search">Search</Label>
              <Input
                id="bid-search"
                placeholder="Bid name or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bid-status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="bid-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Won">Won</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Bids</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton 
                  headers={['Number', 'Name', 'Status', 'Client', 'Value', 'Due Date']}
                  rows={5}
                />
              </div>
            </>
          ) : bids.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No bids yet"
              description="Start winning work by creating your first bid. Track estimates, due dates, and follow up on every opportunity."
              actionLabel="+ Create Your First Bid"
              actionHref="/bids/new"
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {bids.map((bid) => (
                  <div key={bid.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/bids/${bid.id}`}
                          className="font-medium text-amber-700 hover:underline text-sm"
                        >
                          {bid.name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {bid.number}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${statusColor(bid.status)} text-xs shrink-0`}
                      >
                        {statusLabel(bid.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Client</span>
                        <p className="font-medium">{bid.owner || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Value</span>
                        <p className="font-medium font-mono">
                          {bid.estimatedValue ? formatCurrency(bid.estimatedValue) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Due {bid.dueDate ? new Date(bid.dueDate).toLocaleDateString() : "—"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bids.map((bid) => (
                      <TableRow key={bid.id}>
                        <TableCell className="font-mono text-sm">
                          {bid.number}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/bids/${bid.id}`}
                            className="font-medium text-amber-700 hover:underline"
                          >
                            {bid.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusColor(bid.status)}
                          >
                            {statusLabel(bid.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{bid.owner || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {bid.estimatedValue
                            ? formatCurrency(bid.estimatedValue)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {bid.dueDate
                            ? new Date(bid.dueDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
