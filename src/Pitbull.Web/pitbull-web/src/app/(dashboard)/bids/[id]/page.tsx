"use client";

import { use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const bid = {
  id: "1",
  number: "B-2024-010",
  name: "City Hall HVAC Upgrade",
  status: "Submitted",
  description:
    "Complete replacement of the HVAC system in the main City Hall building. Includes removal of existing equipment, installation of high-efficiency units, new ductwork, and BMS integration.",
  value: 850000,
  client: "City of Springfield",
  bidDate: "2024-01-10",
  dueDate: "2024-02-15",
  estimator: "Mike Chen",
  notes: "Pre-bid meeting scheduled for Jan 20. Site visit required. Prevailing wage project.",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function BidDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{bid.name}</h1>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {bid.status}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">{bid.number} · ID: {id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit</Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">Submit Bid</Button>
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
              <span className="font-medium">{bid.client}</span>
              <span className="text-muted-foreground">Bid Value</span>
              <span className="font-medium font-mono">{formatCurrency(bid.value)}</span>
              <span className="text-muted-foreground">Estimator</span>
              <span className="font-medium">{bid.estimator}</span>
              <span className="text-muted-foreground">Bid Date</span>
              <span className="font-medium">{bid.bidDate || "Not set"}</span>
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-medium">{bid.dueDate}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {bid.description}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{bid.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bid Items</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No line items added yet.</p>
          <Button variant="outline" className="mt-3" size="sm">
            Add Line Item
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild>
          <Link href="/bids">← Back to Bids</Link>
        </Button>
      </div>
    </div>
  );
}
