"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_PAGE_SIZE = 50;

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

interface BankTransactionDto {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  description: string;
  amount: number;
  checkNumber?: string;
  referenceNumber?: string;
  transactionType: "Check" | "Deposit" | "Transfer" | "Fee" | "Interest" | "Other";
  isCleared: boolean;
  bankReconciliationId?: string;
  matchedJournalEntryId?: string;
  clearedAt?: string;
  createdAt: string;
}

interface BankReconciliationDto {
  id: string;
  bankAccountId: string;
  bankAccountName?: string;
  statementDate: string;
  statementEndingBalance: number;
  beginningBalance: number;
  clearedDeposits: number;
  clearedWithdrawals: number;
  difference: number;
  status: "InProgress" | "Completed";
  completedByUserId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface TransactionListResult {
  items: BankTransactionDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ReconciliationListResult {
  items: BankReconciliationDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReconciliationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const bankAccountId = params.id as string;

  // Bank account
  const [account, setAccount] = useState<BankAccountDto | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // Active reconciliation
  const [activeRecon, setActiveRecon] = useState<BankReconciliationDto | null>(null);

  // Transactions
  const [transactions, setTransactions] = useState<BankTransactionDto[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txTotalCount, setTxTotalCount] = useState(0);
  const [txSearch, setTxSearch] = useState("");

  // Reconciliation history
  const [reconHistory, setReconHistory] = useState<BankReconciliationDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Dialogs
  const [startReconOpen, setStartReconOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);

  // Start reconciliation form
  const [statementDate, setStatementDate] = useState("");
  const [statementEndingBalance, setStatementEndingBalance] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  // Import CSV
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Edit account form
  const [editForm, setEditForm] = useState({ accountName: "", bankName: "", isActive: true });
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Clearing/unclearing
  const [clearingId, setClearingId] = useState<string | null>(null);

  // Completing
  const [isCompleting, setIsCompleting] = useState(false);

  // Fetch bank account
  const fetchAccount = useCallback(async () => {
    setIsLoadingAccount(true);
    try {
      const result = await api<BankAccountDto>(`/api/bank-accounts/${bankAccountId}`);
      setAccount(result);
      setEditForm({ accountName: result.accountName, bankName: result.bankName, isActive: result.isActive });
    } catch {
      toast.error("Failed to load bank account");
    } finally {
      setIsLoadingAccount(false);
    }
  }, [bankAccountId]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoadingTx(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(txPage));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (txSearch.trim()) params.set("search", txSearch.trim());

      const result = await api<TransactionListResult>(
        `/api/bank-accounts/${bankAccountId}/transactions?${params.toString()}`
      );
      setTransactions(result.items);
      setTxTotalCount(result.totalCount);
      setTxTotalPages(Math.max(result.totalPages || 1, 1));
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setIsLoadingTx(false);
    }
  }, [bankAccountId, txPage, txSearch]);

  // Fetch reconciliation history
  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      params.set("bankAccountId", bankAccountId);
      params.set("page", "1");
      params.set("pageSize", "50");

      const result = await api<ReconciliationListResult>(`/api/bank-reconciliations?${params.toString()}`);
      setReconHistory(result.items);

      // Find active (InProgress) reconciliation
      const active = result.items.find((r) => r.status === "InProgress");
      setActiveRecon(active || null);
    } catch {
      toast.error("Failed to load reconciliation history");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [bankAccountId]);

  useEffect(() => {
    fetchAccount();
    fetchHistory();
  }, [fetchAccount, fetchHistory]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setTxPage(1);
  }, [txSearch]);

  // Refresh active reconciliation details
  async function refreshActiveRecon() {
    if (!activeRecon) return;
    try {
      const updated = await api<BankReconciliationDto>(`/api/bank-reconciliations/${activeRecon.id}`);
      setActiveRecon(updated);
    } catch {
      // Silently fail — data will refresh on next full fetch
    }
  }

  // Start new reconciliation
  async function handleStartReconciliation() {
    if (!statementDate) {
      toast.error("Statement date is required");
      return;
    }
    const balance = parseFloat(statementEndingBalance);
    if (isNaN(balance)) {
      toast.error("Statement ending balance must be a valid number");
      return;
    }

    setIsStarting(true);
    try {
      const result = await api<BankReconciliationDto>("/api/bank-reconciliations/start", {
        method: "POST",
        body: {
          bankAccountId,
          statementDate,
          statementEndingBalance: balance,
        },
      });
      setActiveRecon(result);
      setStartReconOpen(false);
      setStatementDate("");
      setStatementEndingBalance("");
      toast.success("Reconciliation started");
      fetchHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start reconciliation");
    } finally {
      setIsStarting(false);
    }
  }

  // Clear (match) a transaction
  async function handleClear(tx: BankTransactionDto) {
    if (!activeRecon) {
      toast.error("Start a reconciliation first");
      return;
    }
    setClearingId(tx.id);
    try {
      await api(`/api/bank-reconciliations/${activeRecon.id}/match`, {
        method: "POST",
        body: { bankTransactionId: tx.id },
      });
      toast.success("Transaction cleared");
      fetchTransactions();
      refreshActiveRecon();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear transaction");
    } finally {
      setClearingId(null);
    }
  }

  // Unclear (unmatch) a transaction
  async function handleUnclear(tx: BankTransactionDto) {
    if (!activeRecon) {
      toast.error("No active reconciliation");
      return;
    }
    setClearingId(tx.id);
    try {
      await api(`/api/bank-reconciliations/${activeRecon.id}/unmatch`, {
        method: "POST",
        body: { bankTransactionId: tx.id },
      });
      toast.success("Transaction uncleared");
      fetchTransactions();
      refreshActiveRecon();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unclear transaction");
    } finally {
      setClearingId(null);
    }
  }

  // Complete reconciliation
  async function handleComplete() {
    if (!activeRecon) return;
    if (activeRecon.difference !== 0) {
      toast.error("Difference must be $0.00 to complete reconciliation");
      return;
    }
    if (!confirm("Complete this reconciliation? This action cannot be undone.")) return;

    setIsCompleting(true);
    try {
      await api(`/api/bank-reconciliations/${activeRecon.id}/complete`, { method: "POST" });
      toast.success("Reconciliation completed");
      setActiveRecon(null);
      fetchHistory();
      fetchTransactions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete reconciliation");
    } finally {
      setIsCompleting(false);
    }
  }

  // Import CSV transactions
  async function handleImport() {
    if (!csvData.trim()) {
      toast.error("Paste CSV data to import");
      return;
    }

    // Parse CSV lines — expected format: date, description, amount, [checkNumber], [type]
    const rawLines = csvData.trim().split("\n");
    const lines: Array<{
      transactionDate: string;
      description: string;
      amount: number;
      checkNumber?: string;
      transactionType?: string;
    }> = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      // Skip header row if detected
      const lower = line.toLowerCase();
      if (lower.includes("date") && lower.includes("description") && lower.includes("amount")) continue;

      const parts = line.split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1"));
      if (parts.length < 3) {
        toast.error(`Line ${i + 1}: Expected at least date, description, amount`);
        return;
      }

      const amount = parseFloat(parts[2]);
      if (isNaN(amount)) {
        toast.error(`Line ${i + 1}: Invalid amount "${parts[2]}"`);
        return;
      }

      lines.push({
        transactionDate: parts[0],
        description: parts[1],
        amount,
        checkNumber: parts[3] || undefined,
        transactionType: parts[4] || undefined,
      });
    }

    if (lines.length === 0) {
      toast.error("No valid lines found in CSV data");
      return;
    }

    setIsImporting(true);
    try {
      await api(`/api/bank-accounts/${bankAccountId}/transactions/import`, {
        method: "POST",
        body: { lines },
      });
      toast.success(`${lines.length} transaction(s) imported`);
      setImportDialogOpen(false);
      setCsvData("");
      fetchTransactions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import transactions");
    } finally {
      setIsImporting(false);
    }
  }

  // Delete a transaction
  async function handleDeleteTransaction(tx: BankTransactionDto) {
    if (!confirm(`Delete transaction "${tx.description}"?`)) return;
    try {
      await api(`/api/bank-accounts/transactions/${tx.id}`, { method: "DELETE" });
      toast.success("Transaction deleted");
      fetchTransactions();
      if (activeRecon) refreshActiveRecon();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete transaction");
    }
  }

  // Edit bank account
  async function handleSaveAccount() {
    if (!editForm.accountName.trim() || !editForm.bankName.trim()) {
      toast.error("Account name and bank name are required");
      return;
    }
    setIsSavingAccount(true);
    try {
      await api(`/api/bank-accounts/${bankAccountId}`, {
        method: "PUT",
        body: editForm,
      });
      toast.success("Bank account updated");
      setEditAccountOpen(false);
      fetchAccount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update bank account");
    } finally {
      setIsSavingAccount(false);
    }
  }

  // Delete bank account
  async function handleDeleteAccount() {
    if (!confirm("Delete this bank account? This cannot be undone.")) return;
    try {
      await api(`/api/bank-accounts/${bankAccountId}`, { method: "DELETE" });
      toast.success("Bank account deleted");
      router.push("/accounting/bank-reconciliation");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete bank account");
    }
  }

  // Sort transactions: uncleared first, then by date descending
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (a.isCleared !== b.isCleared) return a.isCleared ? 1 : -1;
    return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
  });

  const unclearedTx = transactions.filter((t) => !t.isCleared);
  const clearedTx = transactions.filter((t) => t.isCleared);

  if (isLoadingAccount) {
    return (
      <div className="space-y-6">
        <TableSkeleton headers={["Date", "Description", "Amount", "Type", "Status", "Actions"]} rows={8} />
      </div>
    );
  }

  if (!account) {
    return (
      <EmptyState
        title="Bank account not found"
        description="This bank account may have been deleted."
        actionLabel="Back to Bank Accounts"
        actionHref="/accounting/bank-reconciliation"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="outline" size="sm" onClick={() => router.push("/accounting/bank-reconciliation")}>
              Back
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {account.bankName} - {account.accountName}
          </h1>
          <p className="text-muted-foreground">
            ****{account.accountNumberLast4} | {account.accountType} |{" "}
            {account.glAccountNumber ? `${account.glAccountNumber} - ${account.glAccountName}` : "No GL"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditAccountOpen(true)}>
            Edit Account
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            Import CSV
          </Button>
          {!activeRecon && (
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => setStartReconOpen(true)}
            >
              Start Reconciliation
            </Button>
          )}
        </div>
      </div>

      {/* Balance summary cards — only when reconciliation is active */}
      {activeRecon && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Statement Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono">
                {formatCurrency(activeRecon.statementEndingBalance)}
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(activeRecon.statementDate)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Beginning Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono">
                {formatCurrency(activeRecon.beginningBalance)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Cleared Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono text-green-600">
                {formatCurrency(activeRecon.clearedDeposits)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Cleared Withdrawals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono text-red-600">
                {formatCurrency(activeRecon.clearedWithdrawals)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Difference</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-lg font-bold font-mono ${
                  activeRecon.difference === 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(activeRecon.difference)}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeRecon.difference === 0 ? "Balanced" : "Out of balance"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active reconciliation controls */}
      {activeRecon && (
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Reconciliation In Progress</Badge>
          <LoadingButton
            className="bg-amber-500 hover:bg-amber-600 text-white"
            loading={isCompleting}
            disabled={activeRecon.difference !== 0}
            onClick={handleComplete}
          >
            Complete Reconciliation
          </LoadingButton>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Bank Transactions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Bank Transactions</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {unclearedTx.length} uncleared / {clearedTx.length} cleared
                </span>
              </div>
              <div className="mt-2">
                <Input
                  placeholder="Search transactions..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingTx ? (
                <div className="p-4">
                  <TableSkeleton headers={["Date", "Description", "Amount", "Actions"]} rows={5} />
                </div>
              ) : sortedTransactions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No transactions found. Import bank statement data to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className={tx.isCleared ? "bg-muted/30" : ""}
                      >
                        <TableCell className="text-sm">{formatDate(tx.transactionDate)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          <div>{tx.description}</div>
                          {tx.checkNumber && (
                            <span className="text-xs text-muted-foreground">Check #{tx.checkNumber}</span>
                          )}
                          {tx.referenceNumber && (
                            <span className="text-xs text-muted-foreground">Ref: {tx.referenceNumber}</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm ${
                            tx.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {tx.transactionType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {activeRecon && !tx.isCleared && (
                            <LoadingButton
                              size="sm"
                              variant="outline"
                              loading={clearingId === tx.id}
                              onClick={() => handleClear(tx)}
                            >
                              Clear
                            </LoadingButton>
                          )}
                          {activeRecon && tx.isCleared && tx.bankReconciliationId === activeRecon.id && (
                            <LoadingButton
                              size="sm"
                              variant="outline"
                              loading={clearingId === tx.id}
                              onClick={() => handleUnclear(tx)}
                            >
                              Unclear
                            </LoadingButton>
                          )}
                          {!tx.isCleared && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteTransaction(tx)}
                            >
                              Del
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Transaction pagination */}
          {txTotalCount > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Showing {(txPage - 1) * DEFAULT_PAGE_SIZE + 1}-
                {Math.min(txPage * DEFAULT_PAGE_SIZE, txTotalCount)} of {txTotalCount}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {txPage} / {txTotalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={txPage >= txTotalPages}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Reconciliation History + Info */}
        <div className="space-y-4">
          {/* Account Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Account Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Bank Name</span>
                  <p className="font-medium">{account.bankName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Type</span>
                  <p className="font-medium">{account.accountType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">GL Account</span>
                  <p className="font-medium">
                    {account.glAccountNumber
                      ? `${account.glAccountNumber} - ${account.glAccountName}`
                      : "Not assigned"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Opening Balance</span>
                  <p className="font-medium font-mono">{formatCurrency(account.openingBalance)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p>
                    <Badge variant={account.isActive ? "default" : "secondary"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </p>
                </div>
                {account.openingBalanceDate && (
                  <div>
                    <span className="text-muted-foreground">Opening Date</span>
                    <p className="font-medium">{formatDate(account.openingBalanceDate)}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditAccountOpen(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDeleteAccount}>
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reconciliation History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reconciliation History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingHistory ? (
                <div className="p-4">
                  <TableSkeleton headers={["Date", "Balance", "Difference", "Status"]} rows={3} />
                </div>
              ) : reconHistory.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No reconciliation history. Start your first reconciliation above.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statement Date</TableHead>
                      <TableHead className="text-right">Ending Balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconHistory.map((recon) => (
                      <TableRow key={recon.id}>
                        <TableCell className="text-sm">{formatDate(recon.statementDate)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(recon.statementEndingBalance)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm ${
                            recon.difference === 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(recon.difference)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={recon.status === "Completed" ? "default" : "secondary"}
                          >
                            {recon.status === "InProgress" ? "In Progress" : "Completed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Start Reconciliation Dialog */}
      <Dialog open={startReconOpen} onOpenChange={setStartReconOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Reconciliation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Statement Date *</Label>
              <Input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Statement Ending Balance *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={statementEndingBalance}
                onChange={(e) => setStatementEndingBalance(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartReconOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              loading={isStarting}
              onClick={handleStartReconciliation}
            >
              Start Reconciliation
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Bank Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste CSV data with columns: Date, Description, Amount, Check Number (optional), Type (optional).
              The first row will be skipped if it contains header labels.
            </p>
            <div className="space-y-2">
              <Label>CSV Data</Label>
              <Textarea
                rows={12}
                placeholder={`2026-01-15,Electric bill payment,-450.00,1234,Check\n2026-01-16,Customer deposit,15000.00,,Deposit\n2026-01-17,Bank fee,-25.00,,Fee`}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              loading={isImporting}
              onClick={handleImport}
            >
              Import Transactions
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bank Account Dialog */}
      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={editForm.accountName}
                onChange={(e) => setEditForm((p) => ({ ...p, accountName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={editForm.bankName}
                onChange={(e) => setEditForm((p) => ({ ...p, bankName: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="editIsActive"
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              <Label htmlFor="editIsActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccountOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isSavingAccount} onClick={handleSaveAccount}>
              Save Changes
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
