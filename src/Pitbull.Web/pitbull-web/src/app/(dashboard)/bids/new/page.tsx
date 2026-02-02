"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import api from "@/lib/api";
import type { Bid, CreateBidCommand, BidStatus } from "@/lib/types";
import { toast } from "sonner";

export default function NewBidPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<BidStatus>("Draft");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const command: CreateBidCommand = {
      bidNumber: formData.get("bidNumber") as string,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      status,
      clientName: (formData.get("clientName") as string) || undefined,
      estimatedValue: formData.get("estimatedValue")
        ? Number(formData.get("estimatedValue"))
        : undefined,
      bidDate: (formData.get("bidDate") as string) || undefined,
      dueDate: (formData.get("dueDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    try {
      const bid = await api<Bid>("/api/bids", {
        method: "POST",
        body: command,
      });
      toast.success("Bid created successfully");
      router.push(`/bids/${bid.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create bid"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Bid</h1>
        <p className="text-muted-foreground">Create a new bid proposal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bid Details</CardTitle>
          <CardDescription>
            Enter the information for this bid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bidNumber">Bid Number</Label>
                <Input
                  id="bidNumber"
                  name="bidNumber"
                  placeholder="B-2024-015"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as BidStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Bid Name / Project</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. City Hall HVAC Upgrade"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Scope of Work</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the scope of work for this bid..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Bid Value ($)</Label>
                <Input
                  id="estimatedValue"
                  name="estimatedValue"
                  type="number"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientName">Client / Owner</Label>
                <Input
                  id="clientName"
                  name="clientName"
                  placeholder="Client name"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bidDate">Bid Date</Label>
                <Input id="bidDate" name="bidDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Bid"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
