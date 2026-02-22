"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, CheckCircle2, XCircle, RefreshCw, Plus, Pencil, Trash2, Vault,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/skeletons";
import { toast } from "sonner";
import api from "@/lib/api";
import { useRequireAdmin } from "@/hooks/use-require-admin";

// --- Env-var status types (existing) ---

interface SecretItem {
  key: string;
  displayName: string;
  isConfigured: boolean;
  maskedValue: string | null;
}

interface EnvCategory {
  category: string;
  secrets: SecretItem[];
}

interface SecretsStatusResponse {
  configuredCount: number;
  totalCount: number;
  categories: EnvCategory[];
}

// --- Vault types (new) ---

interface VaultSecret {
  id: string;
  key: string;
  displayName: string;
  maskedValue: string;
  keyFingerprint: string;
  category: string;
  lastRotated: string;
  description: string | null;
  createdAt: string;
}

interface VaultListResult {
  items: VaultSecret[];
  totalCount: number;
}

const CATEGORIES = [
  "API", "SMTP", "Integration", "Authentication", "Database", "Analytics", "Infrastructure",
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function SecretsPage() {
  const { isAdmin } = useRequireAdmin();

  // Env-var status state
  const [envData, setEnvData] = useState<SecretsStatusResponse | null>(null);
  const [isEnvLoading, setIsEnvLoading] = useState(true);

  // Vault state
  const [vaultItems, setVaultItems] = useState<VaultSecret[]>([]);
  const [isVaultLoading, setIsVaultLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<VaultSecret | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [formKey, setFormKey] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formCategory, setFormCategory] = useState("Integration");
  const [formDescription, setFormDescription] = useState("");

  const fetchEnvStatus = useCallback(async () => {
    setIsEnvLoading(true);
    try {
      const res = await api<SecretsStatusResponse>("/api/admin/secrets");
      setEnvData(res);
    } catch {
      toast.error("Failed to load secrets status");
    } finally {
      setIsEnvLoading(false);
    }
  }, []);

  const fetchVault = useCallback(async () => {
    setIsVaultLoading(true);
    try {
      const res = await api<VaultListResult>("/api/admin/secret-vault");
      setVaultItems(res.items);
    } catch {
      toast.error("Failed to load secret vault");
    } finally {
      setIsVaultLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvStatus();
    fetchVault();
  }, [fetchEnvStatus, fetchVault]);

  function resetForm() {
    setFormKey("");
    setFormDisplayName("");
    setFormValue("");
    setFormCategory("Integration");
    setFormDescription("");
  }

  function openCreate() {
    resetForm();
    setEditItem(null);
    setCreateOpen(true);
  }

  function openEdit(item: VaultSecret) {
    setEditItem(item);
    setFormKey(item.key);
    setFormDisplayName(item.displayName);
    setFormValue("");
    setFormCategory(item.category);
    setFormDescription(item.description || "");
    setCreateOpen(true);
  }

  async function handleSave() {
    if (!editItem && !formKey.trim()) {
      toast.error("Key is required");
      return;
    }
    if (!editItem && !formValue.trim()) {
      toast.error("Value is required");
      return;
    }
    setIsSaving(true);
    try {
      if (editItem) {
        await api(`/api/admin/secret-vault/${editItem.id}`, {
          method: "PUT",
          body: {
            displayName: formDisplayName || null,
            value: formValue || null,
            category: formCategory,
            description: formDescription || null,
          },
        });
        toast.success("Secret updated");
      } else {
        await api("/api/admin/secret-vault", {
          method: "POST",
          body: {
            key: formKey.trim(),
            displayName: formDisplayName.trim() || formKey.trim(),
            value: formValue,
            category: formCategory,
            description: formDescription || null,
          },
        });
        toast.success("Secret created");
      }
      setCreateOpen(false);
      setEditItem(null);
      resetForm();
      fetchVault();
    } catch {
      toast.error(editItem ? "Failed to update secret" : "Failed to create secret");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this secret?")) return;
    try {
      await api(`/api/admin/secret-vault/${id}`, { method: "DELETE" });
      toast.success("Secret deleted");
      fetchVault();
    } catch {
      toast.error("Failed to delete secret");
    }
  }

  function handleRefresh() {
    fetchEnvStatus();
    fetchVault();
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Secrets" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secrets Management</h1>
          <p className="text-muted-foreground">
            Environment variables and encrypted vault secrets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isEnvLoading || isVaultLoading}
            className="min-h-[44px]"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isEnvLoading || isVaultLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" /> Add Secret
          </Button>
        </div>
      </div>

      {/* ── Environment Variables Section ── */}
      {isEnvLoading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardContent>
        </Card>
      ) : envData ? (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {envData.configuredCount} / {envData.totalCount}
                  </div>
                  <p className="text-sm text-muted-foreground">environment variables configured</p>
                </div>
                {envData.configuredCount === envData.totalCount ? (
                  <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    All configured
                  </Badge>
                ) : (
                  <Badge className="ml-auto bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                    {envData.totalCount - envData.configuredCount} missing
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {envData.categories.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="text-base">{category.category}</CardTitle>
                <CardDescription>
                  {category.secrets.filter((s) => s.isConfigured).length} of{" "}
                  {category.secrets.length} configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.secrets.map((secret) => (
                    <div
                      key={secret.key}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {secret.isConfigured ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{secret.displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{secret.key}</p>
                        </div>
                      </div>
                      {secret.isConfigured && secret.maskedValue ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {secret.maskedValue}
                        </code>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-200">
                          Not set
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      ) : null}

      {/* ── Secret Vault Section ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Vault className="h-4 w-4" />
            Secret Vault ({vaultItems.length})
          </CardTitle>
          <CardDescription>
            Encrypted secrets stored in the database. Values are never shown in plaintext.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isVaultLoading ? (
            <TableSkeleton
              headers={["Key", "Display Name", "Category", "Fingerprint", "Last Rotated", "Actions"]}
              rows={3}
            />
          ) : vaultItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No vault secrets yet. Click &quot;Add Secret&quot; to store an encrypted secret.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>Last Rotated</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vaultItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.key}</TableCell>
                      <TableCell className="font-medium">{item.displayName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.keyFingerprint}...</TableCell>
                      <TableCell className="text-sm">{formatDate(item.lastRotated)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
                            title="Edit"
                            aria-label={`Edit ${item.key}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                            aria-label={`Delete ${item.key}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditItem(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Secret" : "Add Secret"}</DialogTitle>
            <DialogDescription>
              {editItem
                ? "Update the secret. Leave value blank to keep the existing value."
                : "Store a new encrypted secret in the vault."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                placeholder="e.g. RESEND_API_KEY"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                disabled={!!editItem}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="e.g. Resend API Key"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Value {editItem && <span className="text-muted-foreground font-normal">(leave blank to keep)</span>}</Label>
              <Input
                type="password"
                placeholder={editItem ? "Enter new value to rotate" : "Secret value"}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What is this secret used for?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditItem(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editItem ? "Update Secret" : "Add Secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
