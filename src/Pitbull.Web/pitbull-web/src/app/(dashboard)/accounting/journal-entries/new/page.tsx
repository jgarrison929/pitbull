"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE_VALUE = "__none__";

interface GlAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
}

interface GlAccountListResult {
  items: GlAccount[];
  totalCount: number;
}

interface LineFormData {
  glAccountId: string;
  debitAmount: string;
  creditAmount: string;
  description: string;
}

const emptyLine: LineFormData = {
  glAccountId: "",
  debitAmount: "",
  creditAmount: "",
  description: "",
};

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineFormData[]>([{ ...emptyLine }, { ...emptyLine }]);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const result = await api<GlAccountListResult>("/api/chart-of-accounts?pageSize=500&isActive=true");
      setAccounts(result.items);
    } catch {
      toast.error("Failed to load GL accounts");
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  function updateLine(index: number, field: keyof LineFormData, value: string) {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) {
      toast.error("At least two lines are required");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debitAmount) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.005 && totalDebits > 0;

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!isBalanced) {
      toast.error("Debits must equal credits and be non-zero");
      return;
    }

    const invalidLines = lines.some((l) => !l.glAccountId);
    if (invalidLines) {
      toast.error("All lines must have a GL account selected");
      return;
    }

    setIsSubmitting(true);
    try {
      await api("/api/journal-entries", {
        method: "POST",
        body: {
          entryDate,
          description: description.trim(),
          lines: lines.map((l) => ({
            glAccountId: l.glAccountId,
            debitAmount: parseFloat(l.debitAmount) || 0,
            creditAmount: parseFloat(l.creditAmount) || 0,
            description: l.description || null,
          })),
        },
      });
      toast.success("Journal entry created");
      router.push("/accounting/journal-entries");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create journal entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Journal Entry</h1>
          <p className="text-muted-foreground">Create a general ledger journal entry</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/accounting/journal-entries")}>
          Cancel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Entry Date</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Input
                placeholder="Description of the journal entry..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lines</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}>
            + Add Line
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-12 items-end border-b pb-4 last:border-0">
                <div className="space-y-2 sm:col-span-4">
                  <Label>GL Account</Label>
                  <Select value={line.glAccountId || NONE_VALUE} onValueChange={(v) => updateLine(index, "glAccountId", v === NONE_VALUE ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Select account...</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.accountNumber} — {a.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Debit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={line.debitAmount}
                    onChange={(e) => updateLine(index, "debitAmount", e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Credit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={line.creditAmount}
                    onChange={(e) => updateLine(index, "creditAmount", e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label>Description</Label>
                  <Input
                    placeholder="Line description..."
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeLine(index)}
                    disabled={lines.length <= 2}
                  >
                    X
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Total Debits: </span>
                <span className="font-mono font-medium">{formatCurrency(totalDebits)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Credits: </span>
                <span className="font-mono font-medium">{formatCurrency(totalCredits)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Difference: </span>
                <span className={`font-mono font-medium ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(totalDebits - totalCredits))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/accounting/journal-entries")}>
          Cancel
        </Button>
        <LoadingButton loading={isSubmitting} onClick={handleSubmit} disabled={!isBalanced}>
          Create Entry
        </LoadingButton>
      </div>
    </div>
  );
}
