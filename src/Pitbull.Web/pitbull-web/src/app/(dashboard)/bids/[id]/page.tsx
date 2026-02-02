"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";
import type { Bid, Project } from "@/lib/types";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function statusColor(status: string) {
  switch (status) {
    case "Submitted":
      return "bg-blue-100 text-blue-700";
    case "Draft":
      return "bg-neutral-100 text-neutral-600";
    case "InProgress":
      return "bg-yellow-100 text-yellow-700";
    case "Won":
      return "bg-green-100 text-green-700";
    case "Lost":
      return "bg-red-100 text-red-600";
    case "NoDecision":
      return "bg-neutral-100 text-neutral-500";
    case "Withdrawn":
      return "bg-neutral-200 text-neutral-500";
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

export default function BidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [bid, setBid] = useState<Bid | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [projectNumber, setProjectNumber] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    async function fetchBid() {
      try {
        const data = await api<Bid>(`/api/bids/${id}`);
        setBid(data);
      } catch {
        setError("Failed to load bid");
        toast.error("Failed to load bid");
      } finally {
        setIsLoading(false);
      }
    }
    fetchBid();
  }, [id]);

  async function handleConvertToProject() {
    if (!projectNumber.trim()) {
      toast.error("Please enter a project number");
      return;
    }
    setIsConverting(true);
    try {
      const project = await api<Project>(
        `/api/bids/${id}/convert-to-project`,
        {
          method: "POST",
          body: { projectNumber: projectNumber.trim() },
        }
      );
      toast.success("Bid converted to project successfully!");
      setConvertOpen(false);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to convert bid"
      );
    } finally {
      setIsConverting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !bid) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {error || "Bid not found"}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/bids">Back to Bids</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{bid.name}</h1>
            <Badge
              variant="secondary"
              className={statusColor(bid.status)}
            >
              {statusLabel(bid.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            {bid.bidNumber}
          </p>
        </div>
        <div className="flex gap-2">
          {bid.status === "Won" && (
            <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  🏗️ Convert to Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convert Bid to Project</DialogTitle>
                  <DialogDescription>
                    Create a new project from this winning bid. Enter a project
                    number to get started.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectNumber">Project Number</Label>
                    <Input
                      id="projectNumber"
                      placeholder="P-2024-001"
                      value={projectNumber}
                      onChange={(e) => setProjectNumber(e.target.value)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>
                      This will create a new project from{" "}
                      <strong>{bid.bidNumber}</strong> — {bid.name}
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setConvertOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                    onClick={handleConvertToProject}
                    disabled={isConverting}
                  >
                    {isConverting ? "Converting..." : "Convert"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bid Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">
                {bid.clientName || "—"}
              </span>
              <span className="text-muted-foreground">Bid Value</span>
              <span className="font-medium font-mono">
                {bid.estimatedValue
                  ? formatCurrency(bid.estimatedValue)
                  : "—"}
              </span>
              <span className="text-muted-foreground">Bid Date</span>
              <span className="font-medium">
                {bid.bidDate
                  ? new Date(bid.bidDate).toLocaleDateString()
                  : "Not set"}
              </span>
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-medium">
                {bid.dueDate
                  ? new Date(bid.dueDate).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {bid.description || "No description provided."}
            </p>
          </CardContent>
        </Card>
      </div>

      {bid.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{bid.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bid Items</CardTitle>
        </CardHeader>
        <CardContent>
          {bid.bidItems && bid.bidItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bid.bidItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.unitCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell colSpan={4} className="text-right">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(
                      bid.bidItems.reduce(
                        (sum, item) => sum + item.totalCost,
                        0
                      )
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No line items added yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild className="min-h-[44px]">
          <Link href="/bids">← Back to Bids</Link>
        </Button>
      </div>
    </div>
  );
}
