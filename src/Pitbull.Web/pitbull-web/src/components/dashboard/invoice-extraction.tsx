"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export interface InvoiceExtractionResult {
  vendorName: string | null;
  vendorNameConfidence: number;
  invoiceNumber: string | null;
  invoiceNumberConfidence: number;
  invoiceDate: string | null;
  invoiceDateConfidence: number;
  dueDate: string | null;
  dueDateConfidence: number;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    costCode: string | null;
  }[];
  subTotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  totalAmountConfidence: number;
  overallConfidence: number;
  matchedVendorId: string | null;
  matchedVendorName: string | null;
  warnings: string[];
}

export interface InvoiceFormValues {
  vendorId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
}

function getConfidenceColor(score: number): string {
  if (score >= 0.8)
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
  if (score >= 0.5)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
}

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function InvoiceExtraction({
  onApply,
}: {
  onApply: (values: InvoiceFormValues, result: InvoiceExtractionResult) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<InvoiceExtractionResult | null>(null);

  const handleExtract = useCallback(async () => {
    if (!selectedFile && !pastedText.trim()) {
      toast.error("Upload a file or paste invoice text");
      return;
    }

    setIsExtracting(true);
    setResult(null);

    try {
      let data: InvoiceExtractionResult;

      if (selectedFile) {
        data = await uploadFiles<InvoiceExtractionResult>(
          "/api/vendor-invoices/extract",
          [selectedFile]
        );
      } else {
        data = await api<InvoiceExtractionResult>(
          "/api/vendor-invoices/extract",
          {
            method: "POST",
            body: { text: pastedText.trim() },
          }
        );
      }

      setResult(data);
      toast.success("Invoice analyzed successfully");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to extract invoice data";
      toast.error(message);
    } finally {
      setIsExtracting(false);
    }
  }, [selectedFile, pastedText]);

  const handleApply = useCallback(() => {
    if (!result) return;

    onApply(
      {
        vendorId: result.matchedVendorId || "",
        invoiceNumber: result.invoiceNumber || "",
        invoiceDate: result.invoiceDate || "",
        dueDate: result.dueDate || "",
        totalAmount: result.totalAmount ?? 0,
      },
      result
    );

    toast.success("Fields auto-filled from AI extraction");
  }, [result, onApply]);

  const handleDiscard = useCallback(() => {
    setResult(null);
    setSelectedFile(null);
    setPastedText("");
  }, []);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">AI Invoice Extraction</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && (
          <>
            {/* Drop zone */}
            <div
              className="rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-amber-400"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) setSelectedFile(file);
              }}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drop invoice here or click to upload
              </p>
              <Input
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="max-w-xs mx-auto"
              />
              {selectedFile && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            {/* Or paste text */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Or paste invoice text here
              </p>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={4}
                placeholder="Paste invoice content..."
              />
            </div>

            {/* Extract button */}
            <Button
              onClick={handleExtract}
              disabled={isExtracting || (!selectedFile && !pastedText.trim())}
              className="bg-amber-500 hover:bg-amber-600 text-white"
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
          </>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Overall confidence */}
            <div className="flex items-center gap-3">
              <Badge
                className={cn(
                  "text-xs",
                  getConfidenceColor(result.overallConfidence)
                )}
              >
                Overall: {formatConfidence(result.overallConfidence)} confidence
              </Badge>
              {result.matchedVendorName && (
                <span className="text-sm text-muted-foreground">
                  Matched to:{" "}
                  <span className="font-medium text-foreground">
                    {result.matchedVendorName}
                  </span>
                </span>
              )}
              {!result.matchedVendorId && result.vendorName && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  No matching vendor found
                </span>
              )}
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-1.5">
                {result.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-900 dark:bg-amber-950/30"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {warning}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted fields */}
            <div className="space-y-2 rounded-lg border p-3">
              <ExtractedField
                label="Vendor"
                value={result.vendorName}
                confidence={result.vendorNameConfidence}
              />
              <ExtractedField
                label="Invoice #"
                value={result.invoiceNumber}
                confidence={result.invoiceNumberConfidence}
              />
              <ExtractedField
                label="Invoice Date"
                value={result.invoiceDate}
                confidence={result.invoiceDateConfidence}
              />
              <ExtractedField
                label="Due Date"
                value={result.dueDate}
                confidence={result.dueDateConfidence}
              />
              <ExtractedField
                label="Total Amount"
                value={
                  result.totalAmount != null
                    ? `$${result.totalAmount.toFixed(2)}`
                    : null
                }
                confidence={result.totalAmountConfidence}
              />
              {result.subTotal != null && (
                <ExtractedField
                  label="Subtotal"
                  value={`$${result.subTotal.toFixed(2)}`}
                  confidence={1}
                />
              )}
              {result.taxAmount != null && (
                <ExtractedField
                  label="Tax"
                  value={`$${result.taxAmount.toFixed(2)}`}
                  confidence={1}
                />
              )}
            </div>

            {/* Line items */}
            {result.lineItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Line Items ({result.lineItems.length})
                </p>
                <div className="max-h-48 overflow-auto border rounded-lg">
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
                          <TableCell className="text-xs">
                            {item.description}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            ${item.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            ${item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.costCode || "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleApply}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Apply to Form
              </Button>
              <Button variant="outline" onClick={handleDiscard}>
                <X className="mr-2 h-4 w-4" />
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExtractedField({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string | null;
  confidence: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm flex-1">{value || "--"}</span>
      <Badge className={cn("text-[10px]", getConfidenceColor(confidence))}>
        {formatConfidence(confidence)}
      </Badge>
    </div>
  );
}
