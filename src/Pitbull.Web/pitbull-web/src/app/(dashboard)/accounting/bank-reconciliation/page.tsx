"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

interface BankAccountDto {
  id: string;
  accountName: string;
  bankName: string;
  accountNumberLast4: string;
  routingNumber?: string;
  glAccountId: string;
  glAccountNumber?: string;
  glAccountName?: string;
  accountType: "Checking" | "Savings" | "MoneyMarket";
  isActive: boolean;
  openingBalance: number;
  openingBalanceDate?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ListResult {
  items: BankAccountDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function BankReconciliationPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccountDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (activeFilter !== ALL_VALUE) params.set("isActive", activeFilter);

      const result = await api<ListResult>(`/api/bank-accounts?${params.toString()}`);
      setAccounts(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(result.totalPages || 1, 1));
    } catch {
      toast.error("Failed to load bank accounts");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, activeFilter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground">Manage bank accounts and reconcile transactions</p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => router.push("/accounting/bank-reconciliation/new")}
        >
          + New Bank Account
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
                placeholder="Bank name, account name..."
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
                  <SelectItem value={ALL_VALUE}>All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton headers={["Bank Name", "Account Name", "Last 4", "GL Account", "Type", "Status"]} rows={8} />
      ) : totalCount === 0 ? (
        <EmptyState
          title="No bank accounts found"
          description="Add your first bank account to start reconciling transactions."
          actionLabel="+ New Bank Account"
          actionHref="/accounting/bank-reconciliation/new"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead>GL Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/accounting/bank-reconciliation/${account.id}`)}
                  >
                    <TableCell className="font-medium">{account.bankName}</TableCell>
                    <TableCell>{account.accountName}</TableCell>
                    <TableCell className="font-mono">****{account.accountNumberLast4}</TableCell>
                    <TableCell>
                      {account.glAccountNumber
                        ? `${account.glAccountNumber} - ${account.glAccountName}`
                        : "---"}
                    </TableCell>
                    <TableCell>{account.accountType}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(account.openingBalance)}</TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {totalCount === 0 ? 0 : (page - 1) * DEFAULT_PAGE_SIZE + 1}-
          {Math.min(page * DEFAULT_PAGE_SIZE, totalCount)} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span>
            Page {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
