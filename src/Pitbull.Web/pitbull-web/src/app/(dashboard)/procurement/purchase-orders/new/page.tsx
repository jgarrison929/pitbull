"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PurchaseOrderLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<PurchaseOrderLineInput[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateLine(index: number, patch: Partial<PurchaseOrderLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!projectId || !vendorId) {
      toast.error("Project ID and Vendor ID are required");
      return;
    }

    const validLines = lines.filter((line) => line.description.trim() && line.quantity > 0);
    if (validLines.length === 0) {
      toast.error("At least one valid line is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await api("/api/purchase-orders", {
        method: "POST",
        body: {
          projectId,
          vendorId,
          description: description.trim() || null,
          lines: validLines,
        },
      });

      toast.success("Purchase order created");
      router.push("/procurement/purchase-orders");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Purchase Order</h1>
        <p className="text-muted-foreground">Create a purchase order with line items for vendor commitments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="projectId">Project ID</Label>
              <Input id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="uuid" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor ID</Label>
              <Input id="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="uuid" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button type="button" variant="outline" onClick={addLine}>Add Line</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => (
            <div key={`line-${index}`} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  placeholder="Line description"
                />
              </div>
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => removeLine(index)} disabled={lines.length === 1}>
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push("/procurement/purchase-orders")}>Cancel</Button>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Purchase Order"}
        </Button>
      </div>
    </div>
  );
}
