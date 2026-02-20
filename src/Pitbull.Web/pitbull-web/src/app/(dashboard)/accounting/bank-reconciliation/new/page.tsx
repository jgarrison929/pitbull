"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";

const NONE_VALUE = "__none__";

const accountTypes = ["Checking", "Savings", "MoneyMarket"] as const;
type AccountType = (typeof accountTypes)[number];

interface GLAccount {
  id: string;
  accountNumber: string;
  accountName: string;
}

interface CreateBankAccountRequest {
  accountName: string;
  bankName: string;
  accountNumberLast4: string;
  routingNumber?: string;
  glAccountId: string;
  accountType: AccountType;
  openingBalance: number;
  openingBalanceDate?: string;
}

interface FormData {
  accountName: string;
  bankName: string;
  accountNumberLast4: string;
  routingNumber: string;
  glAccountId: string;
  accountType: AccountType;
  openingBalance: string;
  openingBalanceDate: string;
}

const emptyFormData: FormData = {
  accountName: "",
  bankName: "",
  accountNumberLast4: "",
  routingNumber: "",
  glAccountId: NONE_VALUE,
  accountType: "Checking",
  openingBalance: "0.00",
  openingBalanceDate: "",
};

export default function NewBankAccountPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGlAccounts = useCallback(async () => {
    try {
      const result = await api<GLAccount[]>("/api/chart-of-accounts/list");
      setGlAccounts(result);
    } catch {
      // Fallback: try the tree endpoint and flatten
      try {
        interface TreeNode {
          id: string;
          accountNumber: string;
          accountName: string;
          children: TreeNode[];
        }
        const tree = await api<TreeNode[]>("/api/chart-of-accounts/tree");
        const flat: GLAccount[] = [];
        function flatten(nodes: TreeNode[]) {
          for (const node of nodes) {
            flat.push({ id: node.id, accountNumber: node.accountNumber, accountName: node.accountName });
            if (node.children) flatten(node.children);
          }
        }
        flatten(tree);
        setGlAccounts(flat);
      } catch {
        toast.error("Failed to load GL accounts");
      }
    }
  }, []);

  useEffect(() => {
    fetchGlAccounts();
  }, [fetchGlAccounts]);

  async function handleSubmit() {
    if (!formData.accountName.trim()) {
      toast.error("Account Name is required");
      return;
    }
    if (!formData.bankName.trim()) {
      toast.error("Bank Name is required");
      return;
    }
    if (!formData.accountNumberLast4.trim() || formData.accountNumberLast4.trim().length !== 4) {
      toast.error("Account Number Last 4 must be exactly 4 digits");
      return;
    }
    if (formData.glAccountId === NONE_VALUE) {
      toast.error("GL Account is required");
      return;
    }

    const balance = parseFloat(formData.openingBalance);
    if (isNaN(balance)) {
      toast.error("Opening Balance must be a valid number");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateBankAccountRequest = {
        accountName: formData.accountName.trim(),
        bankName: formData.bankName.trim(),
        accountNumberLast4: formData.accountNumberLast4.trim(),
        routingNumber: formData.routingNumber.trim() || undefined,
        glAccountId: formData.glAccountId,
        accountType: formData.accountType,
        openingBalance: balance,
        openingBalanceDate: formData.openingBalanceDate || undefined,
      };

      await api("/api/bank-accounts", { method: "POST", body: payload });
      toast.success("Bank account created");
      router.push("/accounting/bank-reconciliation");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create bank account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Bank Account</h1>
        <p className="text-muted-foreground">Add a new bank account for reconciliation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g. Operating Account"
                value={formData.accountName}
                onChange={(e) => setFormData((p) => ({ ...p, accountName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input
                placeholder="e.g. Chase, Wells Fargo"
                value={formData.bankName}
                onChange={(e) => setFormData((p) => ({ ...p, bankName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Account Number (Last 4) *</Label>
              <Input
                placeholder="1234"
                maxLength={4}
                value={formData.accountNumberLast4}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setFormData((p) => ({ ...p, accountNumberLast4: val }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Routing Number</Label>
              <Input
                placeholder="Optional"
                value={formData.routingNumber}
                onChange={(e) => setFormData((p) => ({ ...p, routingNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>GL Account *</Label>
              <Select
                value={formData.glAccountId}
                onValueChange={(value) => setFormData((p) => ({ ...p, glAccountId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GL Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>-- Select GL Account --</SelectItem>
                  {glAccounts.map((gl) => (
                    <SelectItem key={gl.id} value={gl.id}>
                      {gl.accountNumber} - {gl.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Type *</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value) => setFormData((p) => ({ ...p, accountType: value as AccountType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "MoneyMarket" ? "Money Market" : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.openingBalance}
                onChange={(e) => setFormData((p) => ({ ...p, openingBalance: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Opening Balance Date</Label>
              <Input
                type="date"
                value={formData.openingBalanceDate}
                onChange={(e) => setFormData((p) => ({ ...p, openingBalanceDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => router.push("/accounting/bank-reconciliation")}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              Create Bank Account
            </LoadingButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
