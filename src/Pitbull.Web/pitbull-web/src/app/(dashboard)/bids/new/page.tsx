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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function NewBidPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Call API to create bid
    setTimeout(() => {
      router.push("/bids");
    }, 500);
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
          <CardDescription>Enter the information for this bid</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="number">Bid Number</Label>
                <Input id="number" name="number" placeholder="B-2024-015" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue="Draft">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Bid Name / Project</Label>
              <Input id="name" name="name" placeholder="e.g. City Hall HVAC Upgrade" required />
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
                <Label htmlFor="value">Bid Value ($)</Label>
                <Input id="value" name="value" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client / Owner</Label>
                <Input id="client" name="client" placeholder="Client name" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bidDate">Bid Date</Label>
                <Input id="bidDate" name="bidDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" name="dueDate" type="date" required />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Bid"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
