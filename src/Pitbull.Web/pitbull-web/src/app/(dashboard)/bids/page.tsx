"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { FileText, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { BidStatus, type PagedResult, type Bid, type UpdateBidCommand } from "@/lib/types";
import { getAllowedBidStatuses } from "@/lib/workflow-transitions";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

const ALL_VALUE = "__all__";

interface BidScoreConfig {
  price: number;
  experience: number;
  compliance: number;
}

interface BidScoreBreakdown {
  bidId: string;
  totalScore: number;
  priceScore: number;
  experienceScore: number;
  complianceScore: number;
}

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
    case BidStatus.Converted:
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100";
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
    case BidStatus.Converted:
      return "Converted";
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

const BID_FILTER_STATUSES: BidStatus[] = [
  BidStatus.Draft,
  BidStatus.Submitted,
  BidStatus.Won,
  BidStatus.Lost,
  BidStatus.NoResponse,
  BidStatus.Cancelled,
  BidStatus.Converted,
];

function getStatusOptions(currentStatus: BidStatus): BidStatus[] {
  return getAllowedBidStatuses(currentStatus);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBidExperienceScore(bid: Bid): number {
  let score = 0;
  if (bid.owner) score += 30;
  if ((bid.description || "").trim().length >= 40) score += 30;
  const itemCount = bid.items?.length ?? 0;
  if (itemCount >= 3) score += 25;
  else if (itemCount > 0) score += 15;
  if (bid.status === BidStatus.Submitted || bid.status === BidStatus.Won) score += 15;
  return Math.min(score, 100);
}

function getBidComplianceScore(bid: Bid): number {
  let score = 0;
  const bidDate = parseDate(bid.bidDate);
  const dueDate = parseDate(bid.dueDate);

  if (bidDate) score += 25;
  if (dueDate) score += 25;
  if (bidDate && dueDate && dueDate >= bidDate) score += 25;
  if ((bid.number || "").trim().length >= 3) score += 10;
  if (bid.estimatedValue > 0) score += 15;

  return Math.min(score, 100);
}

function normalizeWeights(config: BidScoreConfig): BidScoreConfig {
  const total = config.price + config.experience + config.compliance;
  if (total <= 0) {
    return { price: 1 / 3, experience: 1 / 3, compliance: 1 / 3 };
  }

  return {
    price: config.price / total,
    experience: config.experience / total,
    compliance: config.compliance / total,
  };
}

function getPriceScore(value: number, minValue: number, maxValue: number): number {
  if (maxValue <= minValue) return 100;
  const normalized = (maxValue - value) / (maxValue - minValue);
  return Math.max(0, Math.min(100, normalized * 100));
}

export default function BidsPage() {
  const { activeCompany } = useCompany();
  const searchParams = useSearchParams();
  // pipeline=open → Draft + Submitted (precon pipeline)
  const pipelineOpen = searchParams.get("pipeline") === "open";
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (pipelineOpen) return ALL_VALUE;
    return searchParams.get("status") ?? ALL_VALUE;
  });
  const [selectedBidIds, setSelectedBidIds] = useState<string[]>([]);
  const [updatingStatusById, setUpdatingStatusById] = useState<Record<string, boolean>>({});
  const [scoreConfig, setScoreConfig] = useState<BidScoreConfig>({
    price: 45,
    experience: 30,
    compliance: 25,
  });

  useNewShortcut("/bids/new");

  useEffect(() => {
    async function fetchBids() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "100");
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

        const result = await api<PagedResult<Bid>>(`/api/bids?${params.toString()}`);
        let items = result.items;
        if (pipelineOpen) {
          items = items.filter(
            (b) => b.status === BidStatus.Draft || b.status === BidStatus.Submitted
          );
        }
        setBids(items);
      } catch {
        toast.error("Failed to load bids");
      } finally {
        setIsLoading(false);
      }
    }

    const timer = setTimeout(fetchBids, 250);
    return () => clearTimeout(timer);
  }, [activeCompany?.id, search, statusFilter, pipelineOpen]);

  useEffect(() => {
    setSelectedBidIds((prev) => prev.filter((id) => bids.some((bid) => bid.id === id)));
  }, [bids]);

  const weightedScoreMap = useMemo(() => {
    if (bids.length === 0) return new Map<string, BidScoreBreakdown>();

    const minEstimated = Math.min(...bids.map((bid) => bid.estimatedValue));
    const maxEstimated = Math.max(...bids.map((bid) => bid.estimatedValue));
    const weight = normalizeWeights(scoreConfig);

    const map = new Map<string, BidScoreBreakdown>();

    bids.forEach((bid) => {
      const priceScore = getPriceScore(bid.estimatedValue, minEstimated, maxEstimated);
      const experienceScore = getBidExperienceScore(bid);
      const complianceScore = getBidComplianceScore(bid);

      const totalScore =
        priceScore * weight.price +
        experienceScore * weight.experience +
        complianceScore * weight.compliance;

      map.set(bid.id, {
        bidId: bid.id,
        totalScore,
        priceScore,
        experienceScore,
        complianceScore,
      });
    });

    return map;
  }, [bids, scoreConfig]);

  const selectedBids = useMemo(
    () => bids.filter((bid) => selectedBidIds.includes(bid.id)),
    [bids, selectedBidIds]
  );

  const rankedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      const scoreA = weightedScoreMap.get(a.id)?.totalScore ?? 0;
      const scoreB = weightedScoreMap.get(b.id)?.totalScore ?? 0;
      return scoreB - scoreA;
    });
  }, [bids, weightedScoreMap]);

  const timelineBounds = useMemo(() => {
    const dates: Date[] = [];
    bids.forEach((bid) => {
      const created = parseDate(bid.createdAt);
      const bidDate = parseDate(bid.bidDate);
      const dueDate = parseDate(bid.dueDate);
      if (created) dates.push(created);
      if (bidDate) dates.push(bidDate);
      if (dueDate) dates.push(dueDate);
    });

    if (dates.length === 0) return null;

    const min = Math.min(...dates.map((d) => d.getTime()));
    const max = Math.max(...dates.map((d) => d.getTime()));
    return { min, max: Math.max(max, min + 24 * 60 * 60 * 1000) };
  }, [bids]);

  const toggleBidSelection = (bidId: string) => {
    setSelectedBidIds((prev) =>
      prev.includes(bidId) ? prev.filter((id) => id !== bidId) : [...prev, bidId]
    );
  };

  const updateBidStatus = async (bid: Bid, nextStatus: BidStatus) => {
    if (bid.status === nextStatus) return;

    setUpdatingStatusById((prev) => ({ ...prev, [bid.id]: true }));
    try {
      const command: UpdateBidCommand = {
        id: bid.id,
        name: bid.name,
        number: bid.number,
        status: nextStatus,
        estimatedValue: bid.estimatedValue,
        bidDate: bid.bidDate || undefined,
        dueDate: bid.dueDate || undefined,
        owner: bid.owner || undefined,
        description: bid.description || undefined,
        notes: bid.description || undefined,
        items: bid.items?.map((item) => ({
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      };

      await api<Bid>(`/api/bids/${bid.id}`, {
        method: "PUT",
        body: command,
      });

      setBids((prev) =>
        prev.map((entry) => (entry.id === bid.id ? { ...entry, status: nextStatus } : entry))
      );

      toast.success(`Bid status updated to ${statusLabel(nextStatus)}`);
    } catch (err) {
      toast.error("Failed to update bid status", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUpdatingStatusById((prev) => ({ ...prev, [bid.id]: false }));
    }
  };

  const getTimelinePercent = (date: Date | null): number => {
    if (!timelineBounds || !date) return 0;
    return ((date.getTime() - timelineBounds.min) / (timelineBounds.max - timelineBounds.min)) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bids</h1>
          <p className="text-muted-foreground">Track and manage bid proposals</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0">
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
                  {BID_FILTER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Bid Scoring Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="price-weight">Price Weight ({scoreConfig.price})</Label>
            <Input
              id="price-weight"
              type="range"
              min={0}
              max={100}
              value={scoreConfig.price}
              onChange={(e) => setScoreConfig((prev) => ({ ...prev, price: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experience-weight">Experience Weight ({scoreConfig.experience})</Label>
            <Input
              id="experience-weight"
              type="range"
              min={0}
              max={100}
              value={scoreConfig.experience}
              onChange={(e) =>
                setScoreConfig((prev) => ({ ...prev, experience: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="compliance-weight">Compliance Weight ({scoreConfig.compliance})</Label>
            <Input
              id="compliance-weight"
              type="range"
              min={0}
              max={100}
              value={scoreConfig.compliance}
              onChange={(e) =>
                setScoreConfig((prev) => ({ ...prev, compliance: Number(e.target.value) }))
              }
            />
          </div>
          <p className="md:col-span-3 text-xs text-muted-foreground">
            Scores are automatically calculated from existing bid data. Price is normalized against current list values;
            experience and compliance use bid completeness and content heuristics.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bid Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bids available for timeline visualization.</p>
          ) : (
            rankedBids.slice(0, 8).map((bid) => {
              const createdDate = parseDate(bid.createdAt);
              const bidDate = parseDate(bid.bidDate);
              const dueDate = parseDate(bid.dueDate);
              const createdPercent = getTimelinePercent(createdDate);
              const bidPercent = getTimelinePercent(bidDate);
              const duePercent = getTimelinePercent(dueDate);

              return (
                <div key={bid.id} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-sm">{bid.number}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{bid.name}</span>
                    </div>
                    <Badge variant="secondary" className={statusColor(bid.status)}>
                      {statusLabel(bid.status)}
                    </Badge>
                  </div>

                  <div className="relative h-7 rounded-md bg-muted/60 border overflow-hidden">
                    <div className="absolute inset-y-0 left-0 right-0">
                      <div
                        className="absolute top-0 bottom-0 bg-amber-200/70"
                        style={{
                          left: `${Math.min(createdPercent, duePercent || createdPercent)}%`,
                          width: `${Math.abs((duePercent || createdPercent) - createdPercent)}%`,
                        }}
                      />
                    </div>
                    {createdDate && (
                      <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${createdPercent}%` }}>
                        <div className="h-3 w-3 rounded-full bg-slate-500 border border-white" title="Created" />
                      </div>
                    )}
                    {bidDate && (
                      <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${bidPercent}%` }}>
                        <div className="h-3 w-3 rounded-full bg-blue-500 border border-white" title="Bid Date" />
                      </div>
                    )}
                    {dueDate && (
                      <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${duePercent}%` }}>
                        <div className="h-3 w-3 rounded-full bg-red-500 border border-white" title="Due Date" />
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>Created: {createdDate ? createdDate.toLocaleDateString() : "—"}</span>
                    <span>Bid: {bidDate ? bidDate.toLocaleDateString() : "—"}</span>
                    <span>Due: {dueDate ? dueDate.toLocaleDateString() : "—"}</span>
                  </div>
                </div>
              );
            })
          )}
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
                <TableSkeleton headers={["Select", "Number", "Name", "Status", "Client", "Value", "Score"]} rows={5} />
              </div>
            </>
          ) : bids.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No bids yet"
              description="Start winning work by creating your first bid."
              actionLabel="+ Create Your First Bid"
              actionHref="/bids/new"
            />
          ) : (
            <>
              <div className="sm:hidden space-y-3">
                {rankedBids.map((bid) => {
                  const score = weightedScoreMap.get(bid.id);
                  return (
                    <div key={bid.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedBidIds.includes(bid.id)}
                            onChange={() => toggleBidSelection(bid.id)}
                          />
                          Compare
                        </label>
                        <Badge variant="secondary" className={`${statusColor(bid.status)} text-xs shrink-0`}>
                          {statusLabel(bid.status)}
                        </Badge>
                      </div>
                      <div>
                        <Link href={`/bids/${bid.id}`} className="font-medium text-amber-700 hover:underline text-sm">
                          {bid.name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{bid.number}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Value</span>
                          <p className="font-medium font-mono">{formatCurrency(bid.estimatedValue)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Score</span>
                          <p className="font-medium">{(score?.totalScore ?? 0).toFixed(1)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Select</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Status Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankedBids.map((bid) => {
                      const score = weightedScoreMap.get(bid.id);
                      return (
                        <TableRow key={bid.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedBidIds.includes(bid.id)}
                              onChange={() => toggleBidSelection(bid.id)}
                              aria-label={`Compare ${bid.number}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{bid.number}</TableCell>
                          <TableCell>
                            <Link href={`/bids/${bid.id}`} className="font-medium text-amber-700 hover:underline">
                              {bid.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusColor(bid.status)}>
                              {statusLabel(bid.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{bid.owner || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(bid.estimatedValue)}</TableCell>
                          <TableCell className="text-right font-medium">{(score?.totalScore ?? 0).toFixed(1)}</TableCell>
                          <TableCell>
                            <Select
                              value={bid.status}
                              onValueChange={(value) => updateBidStatus(bid, value as BidStatus)}
                              disabled={updatingStatusById[bid.id]}
                            >
                              <SelectTrigger className="h-8 min-w-[136px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getStatusOptions(bid.status).map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {statusLabel(status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedBids.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bid Comparison (Side-by-Side)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Criteria</TableHead>
                  {selectedBids.map((bid) => (
                    <TableHead key={bid.id} className="min-w-[220px]">
                      <div className="space-y-1">
                        <p className="font-medium">{bid.number}</p>
                        <p className="text-xs text-muted-foreground">{bid.name}</p>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Status</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-status`}>
                      <Badge variant="secondary" className={statusColor(bid.status)}>
                        {statusLabel(bid.status)}
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Estimated Value</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-value`} className="font-mono">
                      {formatCurrency(bid.estimatedValue)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Price Score</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-price`}>
                      {(weightedScoreMap.get(bid.id)?.priceScore ?? 0).toFixed(1)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Experience Score</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-exp`}>
                      {(weightedScoreMap.get(bid.id)?.experienceScore ?? 0).toFixed(1)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Compliance Score</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-comp`}>
                      {(weightedScoreMap.get(bid.id)?.complianceScore ?? 0).toFixed(1)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Weighted Total</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-total`} className="font-semibold">
                      {(weightedScoreMap.get(bid.id)?.totalScore ?? 0).toFixed(1)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Bid Date</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-date`}>
                      {bid.bidDate ? new Date(bid.bidDate).toLocaleDateString() : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Due Date</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-due`}>
                      {bid.dueDate ? new Date(bid.dueDate).toLocaleDateString() : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Owner</TableCell>
                  {selectedBids.map((bid) => (
                    <TableCell key={`${bid.id}-owner`}>{bid.owner || "—"}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
