"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { PaginatedResult, Bid } from "@/lib/types";
import { toast } from "sonner";

function statusColor(status: string) {
  switch (status) {
    case "Submitted":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "Draft":
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
    case "InProgress":
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case "Won":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "Lost":
      return "bg-red-100 text-red-600 hover:bg-red-100";
    case "NoDecision":
      return "bg-neutral-100 text-neutral-500 hover:bg-neutral-100";
    case "Withdrawn":
      return "bg-neutral-200 text-neutral-500 hover:bg-neutral-200";
    default:
      return "";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "InProgress":
      return "In Progress";
    case "NoDecision":
      return "No Decision";
    default:
      return status;
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
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBids() {
      try {
        const result = await api<PaginatedResult<Bid>>(
          "/api/bids?pageSize=50"
        );
        setBids(result.items);
      } catch {
        toast.error("Failed to load bids");
      } finally {
        setIsLoading(false);
      }
    }
    fetchBids();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bids</h1>
          <p className="text-muted-foreground">
            Track and manage bid proposals
          </p>
        </div>
        <Button
          asChild
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Link href="/bids/new">+ New Bid</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Bids</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : bids.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No bids yet.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/bids/new">Create your first bid</Link>
              </Button>
            </div>
          ) : (
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
                      {bid.bidNumber}
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
                    <TableCell>{bid.clientName || "—"}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
