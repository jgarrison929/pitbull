"use client";

import { use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Placeholder data
const project = {
  id: "1",
  number: "P-2024-001",
  name: "Downtown Office Complex",
  status: "Active",
  description:
    "A 12-story mixed-use office complex in the downtown business district. Includes ground-floor retail, underground parking, and LEED Gold certification target.",
  budget: 4500000,
  spent: 1875000,
  pm: "Sarah Johnson",
  startDate: "2024-01-15",
  endDate: "2025-06-30",
  client: "Metro Development Corp",
  address: "450 Main Street, Downtown",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const percentSpent = Math.round((project.spent / project.budget) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">{project.number} · ID: {id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit</Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">Add Change Order</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{project.client}</span>
                  <span className="text-muted-foreground">Project Manager</span>
                  <span className="font-medium">{project.pm}</span>
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{project.address}</span>
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">{project.startDate}</span>
                  <span className="text-muted-foreground">End Date</span>
                  <span className="font-medium">{project.endDate}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(project.budget)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Spent to Date</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(project.spent)}</div>
                <div className="mt-2 h-2 rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${percentSpent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{percentSpent}% of budget</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(project.budget - project.spent)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { category: "Labor", amount: 825000, pct: 44 },
                  { category: "Materials", amount: 562500, pct: 30 },
                  { category: "Equipment", amount: 281250, pct: 15 },
                  { category: "Subcontractors", amount: 150000, pct: 8 },
                  { category: "Other", amount: 56250, pct: 3 },
                ].map((item) => (
                  <div key={item.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.category}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-100">
                      <div
                        className="h-1.5 rounded-full bg-amber-400"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No contracts linked to this project yet.</p>
              <Button variant="outline" className="mt-4">
                Link Contract
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild>
          <Link href="/projects">← Back to Projects</Link>
        </Button>
      </div>
    </div>
  );
}
