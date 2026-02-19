"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";

const NONE_VALUE = "__none__";

const accountTypes = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const;
const normalBalances = ["Debit", "Credit"] as const;

type AccountType = typeof accountTypes[number];
type NormalBalance = typeof normalBalances[number];

interface ChartOfAccountNode {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  accountTypeName: string;
  parentAccountId?: string | null;
  description?: string | null;
  isActive: boolean;
  normalBalance: NormalBalance;
  normalBalanceName: string;
  departmentId?: string | null;
  isSubledgerControl: boolean;
  children: ChartOfAccountNode[];
}

interface CreateChartOfAccountCommand {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: string;
  description?: string;
  isActive?: boolean;
  normalBalance?: NormalBalance;
  departmentId?: string;
  isSubledgerControl?: boolean;
}

interface UpdateChartOfAccountCommand {
  accountNumber?: string;
  accountName?: string;
  accountType?: AccountType;
  parentAccountId?: string;
  clearParentAccountId?: boolean;
  description?: string | null;
  isActive?: boolean;
  normalBalance?: NormalBalance;
  departmentId?: string;
  clearDepartmentId?: boolean;
  isSubledgerControl?: boolean;
}

interface AccountFormData {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId: string;
  description: string;
  isActive: boolean;
  normalBalance: NormalBalance;
  departmentId: string;
  isSubledgerControl: boolean;
}

interface FlattenedAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  depth: number;
}

const emptyFormData: AccountFormData = {
  accountNumber: "",
  accountName: "",
  accountType: "Asset",
  parentAccountId: NONE_VALUE,
  description: "",
  isActive: true,
  normalBalance: "Debit",
  departmentId: "",
  isSubledgerControl: false,
};

function flattenAccounts(nodes: ChartOfAccountNode[], depth = 0): Array<ChartOfAccountNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenAccounts(node.children, depth + 1),
  ]);
}

export default function ChartOfAccountsPage() {
  const [tree, setTree] = useState<ChartOfAccountNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountNode | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTree = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ChartOfAccountNode[]>("/api/chart-of-accounts/tree");
      setTree(result);
    } catch {
      toast.error("Failed to load chart of accounts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const flattened = useMemo(() => flattenAccounts(tree), [tree]);

  const filteredAccounts = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return flattened.filter((account) => {
      if (activeFilter !== "all" && String(account.isActive) !== activeFilter) return false;
      if (!normalized) return true;
      return (
        account.accountNumber.toLowerCase().includes(normalized) ||
        account.accountName.toLowerCase().includes(normalized) ||
        (account.description || "").toLowerCase().includes(normalized)
      );
    });
  }, [activeFilter, flattened, search]);

  const parentOptions = useMemo<FlattenedAccount[]>(() => {
    return flattened.map((item) => ({
      id: item.id,
      accountNumber: item.accountNumber,
      accountName: item.accountName,
      depth: item.depth,
    }));
  }, [flattened]);

  function openCreateDialog() {
    setEditingAccount(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(account: ChartOfAccountNode) {
    setEditingAccount(account);
    setFormData({
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      parentAccountId: account.parentAccountId || NONE_VALUE,
      description: account.description || "",
      isActive: account.isActive,
      normalBalance: account.normalBalance,
      departmentId: account.departmentId || "",
      isSubledgerControl: account.isSubledgerControl,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.accountNumber.trim() || !formData.accountName.trim()) {
      toast.error("Account number and account name are required");
      return;
    }

    if (editingAccount && formData.parentAccountId === editingAccount.id) {
      toast.error("An account cannot be its own parent");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        const payload: UpdateChartOfAccountCommand = {
          accountNumber: formData.accountNumber,
          accountName: formData.accountName,
          accountType: formData.accountType,
          parentAccountId: formData.parentAccountId !== NONE_VALUE ? formData.parentAccountId : undefined,
          clearParentAccountId: formData.parentAccountId === NONE_VALUE,
          description: formData.description.trim() || null,
          isActive: formData.isActive,
          normalBalance: formData.normalBalance,
          departmentId: formData.departmentId.trim() || undefined,
          clearDepartmentId: !formData.departmentId.trim(),
          isSubledgerControl: formData.isSubledgerControl,
        };

        await api(`/api/chart-of-accounts/${editingAccount.id}`, { method: "PUT", body: payload });
        toast.success("Account updated");
      } else {
        const payload: CreateChartOfAccountCommand = {
          accountNumber: formData.accountNumber,
          accountName: formData.accountName,
          accountType: formData.accountType,
          parentAccountId: formData.parentAccountId !== NONE_VALUE ? formData.parentAccountId : undefined,
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
          normalBalance: formData.normalBalance,
          departmentId: formData.departmentId.trim() || undefined,
          isSubledgerControl: formData.isSubledgerControl,
        };

        await api("/api/chart-of-accounts", { method: "POST", body: payload });
        toast.success("Account created");
      }

      setDialogOpen(false);
      fetchTree();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save account");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(account: ChartOfAccountNode) {
    if (!confirm(`Delete account \"${account.accountNumber} - ${account.accountName}\"?`)) return;

    try {
      await api(`/api/chart-of-accounts/${account.id}`, { method: "DELETE" });
      toast.success("Account deleted");
      fetchTree();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your GL account structure and hierarchy</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreateDialog}>
          + Add Account
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Account number, name, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton headers={["Account", "Type", "Normal", "Status", "Subledger", "Actions"]} rows={8} />
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          title="No accounts found"
          description="Create your first account to start building your chart of accounts."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Normal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subledger</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div style={{ paddingLeft: `${account.depth * 20}px` }}>
                        <div className="font-medium">
                          {account.accountNumber} - {account.accountName}
                        </div>
                        {account.description && (
                          <div className="text-xs text-muted-foreground">{account.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{account.accountTypeName}</TableCell>
                    <TableCell>{account.normalBalanceName}</TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{account.isSubledgerControl ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(account)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(account)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Create Account"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={formData.accountNumber}
                onChange={(e) => setFormData((p) => ({ ...p, accountNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={formData.accountName}
                onChange={(e) => setFormData((p) => ({ ...p, accountName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
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
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Normal Balance</Label>
              <Select
                value={formData.normalBalance}
                onValueChange={(value) => setFormData((p) => ({ ...p, normalBalance: value as NormalBalance }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {normalBalances.map((balance) => (
                    <SelectItem key={balance} value={balance}>
                      {balance}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Parent Account</Label>
              <Select
                value={formData.parentAccountId}
                onValueChange={(value) => setFormData((p) => ({ ...p, parentAccountId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No Parent (Top Level)</SelectItem>
                  {parentOptions
                    .filter((option) => option.id !== editingAccount?.id)
                    .map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {"\u00A0".repeat(option.depth * 2)}{option.accountNumber} - {option.accountName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Department ID (optional)</Label>
              <Input
                value={formData.departmentId}
                onChange={(e) => setFormData((p) => ({ ...p, departmentId: e.target.value }))}
                placeholder="GUID"
              />
            </div>

            <div className="flex items-center gap-6 pt-7">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span className="text-sm">Active</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isSubledgerControl}
                  onChange={(e) => setFormData((p) => ({ ...p, isSubledgerControl: e.target.checked }))}
                />
                <span className="text-sm">Subledger Control</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isSubmitting} onClick={handleSubmit}>
              {editingAccount ? "Save Changes" : "Create Account"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
