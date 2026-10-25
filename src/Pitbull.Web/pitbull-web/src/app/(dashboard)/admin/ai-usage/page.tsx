"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAdmin } from "@/hooks/use-require-admin";

interface AiUsageSummary {
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

interface AiUsageByUser {
  userId: string;
  userName: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

interface AiUsageByProvider {
  provider: string;
  requestCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

interface AiDailyUsage {
  date: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function AiUsagePage() {
  const { isAdmin } = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [byUser, setByUser] = useState<AiUsageByUser[]>([]);
  const [byProvider, setByProvider] = useState<AiUsageByProvider[]>([]);
  const [daily, setDaily] = useState<AiDailyUsage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = `from=${dateRange.from}&to=${dateRange.to}`;
      const [summaryData, userData, providerData, dailyData] = await Promise.all([
        api<AiUsageSummary>(`/api/ai/usage/summary?${params}`),
        api<AiUsageByUser[]>(`/api/ai/usage/by-user?${params}`),
        api<AiUsageByProvider[]>(`/api/ai/usage/by-provider?${params}`),
        api<AiDailyUsage[]>(`/api/ai/usage/daily?${params}`),
      ]);
      setSummary(summaryData);
      setByUser(userData);
      setByProvider(providerData);
      setDaily(dailyData);
    } catch {
      toast.error("Failed to load AI usage data");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) return null;

  const isEmpty = !summary || summary.totalRequests === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Usage</h1>
          <p className="text-muted-foreground">
            Track AI token consumption, costs, and usage patterns across your organization.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input
              id="from"
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="w-36"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input
              id="to"
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="w-36"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">
                {summary?.totalRequests.toLocaleString() ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <p className="text-2xl font-bold">
                  {formatTokens((summary?.totalTokensIn ?? 0) + (summary?.totalTokensOut ?? 0))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTokens(summary?.totalTokensIn ?? 0)} in / {formatTokens(summary?.totalTokensOut ?? 0)} out
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estimated Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">
                {formatCost(summary?.totalCost ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              No AI usage data for the selected period. AI usage is logged automatically
              when users interact with AI features like chat, document analysis, and smart fields.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Daily Usage Table */}
          {daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell className="text-right">{day.requestCount}</TableCell>
                        <TableCell className="text-right">{formatTokens(day.totalTokens)}</TableCell>
                        <TableCell className="text-right">{formatCost(day.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* By Provider Table */}
          {byProvider.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Usage by Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens In</TableHead>
                      <TableHead className="text-right">Tokens Out</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProvider.map((p) => (
                      <TableRow key={p.provider}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {p.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{p.requestCount}</TableCell>
                        <TableCell className="text-right">{formatTokens(p.totalTokensIn)}</TableCell>
                        <TableCell className="text-right">{formatTokens(p.totalTokensOut)}</TableCell>
                        <TableCell className="text-right">{formatCost(p.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* By User Table */}
          {byUser.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Usage by User</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Total Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byUser.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell>{u.userName}</TableCell>
                        <TableCell className="text-right">{u.requestCount}</TableCell>
                        <TableCell className="text-right">{formatTokens(u.totalTokens)}</TableCell>
                        <TableCell className="text-right">{formatCost(u.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
