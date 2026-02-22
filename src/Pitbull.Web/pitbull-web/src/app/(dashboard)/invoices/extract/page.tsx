"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Upload,
  Loader2,
  FileText,
  Building2,
  ClipboardList,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { uploadFiles } from "@/lib/api";
import api from "@/lib/api";
import { toast } from "sonner";

interface LineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  costCode: string | null;
}

interface VendorMatch {
  id: string;
  name: string;
  code: string;
  confidence: number;
}

interface PurchaseOrderMatch {
  id: string;
  poNumber: string;
  description: string | null;
  totalAmount: number;
  status: string;
  projectId: string;
  projectName: string | null;
}

interface ExtractionResult {
  vendorName: string | null;
  vendorNameConfidence: number;
  invoiceNumber: string | null;
  invoiceNumberConfidence: number;
  invoiceDate: string | null;
  invoiceDateConfidence: number;
  dueDate: string | null;
  dueDateConfidence: number;
  poNumber: string | null;
  poNumberConfidence: number;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  totalConfidence: number;
  overallConfidence: number;
  vendorMatches: VendorMatch[];
  matchedPurchaseOrder: PurchaseOrderMatch | null;
  warnings: string[];
}

function confidenceColor(score: number): string {
  if (score >= 0.8)
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
  if (score >= 0.5)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export default function InvoiceExtractPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);

  // Editable form state (populated from extraction result)
  const [form, setForm] = useState({
    vendorId: "",
    vendorName: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    poNumber: "",
    subtotal: "",
    tax: "",
    total: "",
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!file) {
      toast.error("Select a file first");
      return;
    }

    setIsExtracting(true);
    setResult(null);

    try {
      const data = await uploadFiles<ExtractionResult>(
        "/api/ai/extract-invoice",
        [file]
      );
      setResult(data);

      // Pre-fill editable form from extraction
      setForm({
        vendorId: data.vendorMatches?.[0]?.id ?? "",
        vendorName: data.vendorName ?? "",
        invoiceNumber: data.invoiceNumber ?? "",
        invoiceDate: data.invoiceDate ?? "",
        dueDate: data.dueDate ?? "",
        poNumber: data.poNumber ?? "",
        subtotal: data.subtotal?.toFixed(2) ?? "",
        tax: data.tax?.toFixed(2) ?? "",
        total: data.total?.toFixed(2) ?? "",
      });

      toast.success("Invoice extracted successfully");
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Extraction failed";
      toast.error(msg);
    } finally {
      setIsExtracting(false);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResult(null);
    setForm({
      vendorId: "",
      vendorName: "",
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      poNumber: "",
      subtotal: "",
      tax: "",
      total: "",
    });
  }, []);

  const handleCreateInvoice = useCallback(async () => {
    if (!form.vendorId) {
      toast.error("Select a vendor before creating the invoice");
      return;
    }
    if (!form.invoiceNumber) {
      toast.error("Invoice number is required");
      return;
    }
    if (!form.invoiceDate) {
      toast.error("Invoice date is required");
      return;
    }
    if (!form.dueDate) {
      toast.error("Due date is required");
      return;
    }

    try {
      await api("/api/vendor-invoices", {
        method: "POST",
        body: {
          vendorId: form.vendorId,
          invoiceNumber: form.invoiceNumber,
          invoiceDate: form.invoiceDate || undefined,
          dueDate: form.dueDate || undefined,
          totalAmount: parseFloat(form.total) || 0,
          purchaseOrderId: result?.matchedPurchaseOrder?.id || undefined,
        },
      });
      toast.success("AP Invoice created");
      router.push("/procurement/invoices");
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to create invoice";
      toast.error(msg);
    }
  }, [form, result, router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Invoice Extraction
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload an invoice image to automatically extract data using AI
          </p>
        </div>
        {result && (
          <Button variant="outline" onClick={handleReset}>
            <X className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        )}
      </div>

      {/* Upload zone */}
      {!result && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-12 text-center transition-colors",
                dragOver
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  : "hover:border-amber-400"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium">
                Drop invoice image or PDF here
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                Supports JPEG, PNG, WEBP, GIF, PDF — max 10 MB
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mx-auto max-w-xs"
              />
              {file && (
                <p className="mt-3 text-sm font-medium text-amber-600 dark:text-amber-400">
                  Selected: {file.name} (
                  {(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleExtract}
                disabled={isExtracting || !file}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                size="lg"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing invoice...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract with AI
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main editable form — 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Confidence + warnings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Badge className={cn("text-sm", confidenceColor(result.overallConfidence))}>
                    {pct(result.overallConfidence)} confidence
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    from {file?.name}
                  </span>
                </div>
              </CardHeader>
              {result.warnings.length > 0 && (
                <CardContent className="pt-0 space-y-1.5">
                  {result.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1"
                    >
                      {w}
                    </p>
                  ))}
                </CardContent>
              )}
            </Card>

            {/* Editable fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="vendorName">Vendor Name</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="vendorName"
                        value={form.vendorName}
                        onChange={(e) =>
                          setForm({ ...form, vendorName: e.target.value })
                        }
                      />
                      <Badge
                        className={cn(
                          "text-[10px] shrink-0",
                          confidenceColor(result.vendorNameConfidence)
                        )}
                      >
                        {pct(result.vendorNameConfidence)}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invoiceNumber">Invoice #</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="invoiceNumber"
                        value={form.invoiceNumber}
                        onChange={(e) =>
                          setForm({ ...form, invoiceNumber: e.target.value })
                        }
                      />
                      <Badge
                        className={cn(
                          "text-[10px] shrink-0",
                          confidenceColor(result.invoiceNumberConfidence)
                        )}
                      >
                        {pct(result.invoiceNumberConfidence)}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invoiceDate">Invoice Date</Label>
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={form.invoiceDate}
                      onChange={(e) =>
                        setForm({ ...form, invoiceDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="poNumber">PO Number</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="poNumber"
                        value={form.poNumber}
                        onChange={(e) =>
                          setForm({ ...form, poNumber: e.target.value })
                        }
                      />
                      {result.poNumberConfidence > 0 && (
                        <Badge
                          className={cn(
                            "text-[10px] shrink-0",
                            confidenceColor(result.poNumberConfidence)
                          )}
                        >
                          {pct(result.poNumberConfidence)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Totals */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="subtotal">Subtotal</Label>
                    <Input
                      id="subtotal"
                      type="number"
                      step="0.01"
                      value={form.subtotal}
                      onChange={(e) =>
                        setForm({ ...form, subtotal: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tax">Tax</Label>
                    <Input
                      id="tax"
                      type="number"
                      step="0.01"
                      value={form.tax}
                      onChange={(e) =>
                        setForm({ ...form, tax: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="total">Total</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="total"
                        type="number"
                        step="0.01"
                        value={form.total}
                        className="font-semibold"
                        onChange={(e) =>
                          setForm({ ...form, total: e.target.value })
                        }
                      />
                      <Badge
                        className={cn(
                          "text-[10px] shrink-0",
                          confidenceColor(result.totalConfidence)
                        )}
                      >
                        {pct(result.totalConfidence)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line items */}
            {result.lineItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Line Items ({result.lineItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">
                            Unit Price
                          </TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Cost Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.lineItems.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {item.quantity ?? "--"}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {item.unitPrice != null
                                ? `$${item.unitPrice.toFixed(2)}`
                                : "--"}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {item.amount != null
                                ? `$${item.amount.toFixed(2)}`
                                : "--"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.costCode ?? "--"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Create button */}
            <div className="flex gap-3">
              <Button
                onClick={handleCreateInvoice}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                size="lg"
              >
                Create AP Invoice
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Discard
              </Button>
            </div>
          </div>

          {/* Sidebar — vendor & PO matches */}
          <div className="space-y-6">
            {/* Vendor matches */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vendor Matches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.vendorMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No matching vendors found
                  </p>
                ) : (
                  result.vendorMatches.map((v) => (
                    <button
                      key={v.id}
                      onClick={() =>
                        setForm({
                          ...form,
                          vendorId: v.id,
                          vendorName: v.name,
                        })
                      }
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50",
                        form.vendorId === v.id &&
                          "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{v.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.code}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            confidenceColor(v.confidence)
                          )}
                        >
                          {pct(v.confidence)}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            {/* PO match */}
            {result.matchedPurchaseOrder && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Matched Purchase Order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {result.matchedPurchaseOrder.poNumber}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {result.matchedPurchaseOrder.status}
                      </Badge>
                    </div>
                    {result.matchedPurchaseOrder.description && (
                      <p className="text-xs text-muted-foreground">
                        {result.matchedPurchaseOrder.description}
                      </p>
                    )}
                    <p className="text-sm">
                      ${result.matchedPurchaseOrder.totalAmount.toFixed(2)}
                    </p>
                    {result.matchedPurchaseOrder.projectName && (
                      <p className="text-xs text-muted-foreground">
                        Project: {result.matchedPurchaseOrder.projectName}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
