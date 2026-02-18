"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Key, Plus, Copy, Trash2, Ban, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/use-require-admin";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  scopes: string | null;
  description: string | null;
  createdByEmail: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

interface ApiKeyCreated {
  id: string;
  name: string;
  keyPrefix: string;
  plainTextKey: string;
  scopes: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function ApiKeysPage() {
  const { isAdmin } = useRequireAdmin();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopes, setScopes] = useState("read,write");
  const [expiresIn, setExpiresIn] = useState("90");
  const [isCreating, setIsCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await api<{ items: ApiKey[] }>("/api/admin/api-keys");
      setKeys(res.items);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleCreate() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setIsCreating(true);
    try {
      const result = await api<ApiKeyCreated>("/api/admin/api-keys", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description || null,
          scopes: scopes || null,
          expiresInDays: expiresIn === "never" ? null : parseInt(expiresIn),
        },
      });
      setCreatedKey(result);
      setCreateOpen(false);
      setName(""); setDescription(""); setScopes("read,write"); setExpiresIn("90");
      fetchKeys();
      toast.success("API key created");
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? It will immediately stop working.")) return;
    try {
      await api(`/api/admin/api-keys/${id}/revoke`, { method: "POST" });
      toast.success("API key revoked");
      fetchKeys();
    } catch {
      toast.error("Failed to revoke key");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this API key?")) return;
    try {
      await api(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      toast.success("API key deleted");
      fetchKeys();
    } catch {
      toast.error("Failed to delete key");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "Active": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Active</Badge>;
      case "Revoked": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Revoked</Badge>;
      case "Expired": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">Expired</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "API Keys" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage API keys for external integrations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" /> Create API Key
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys ({keys.length})
          </CardTitle>
          <CardDescription>Keys are hashed — the full key is only shown once when created</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No API keys yet. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">{key.keyPrefix}...</TableCell>
                    <TableCell>{statusBadge(key.status)}</TableCell>
                    <TableCell className="text-sm">{key.scopes || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(key.expiresAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(key.lastUsedAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(key.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {key.status === "Active" && (
                          <Button variant="ghost" size="icon" onClick={() => handleRevoke(key.id)} title="Revoke">
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(key.id)} title="Delete">
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Create a new API key for external integrations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g. ERP Sync, Mobile App" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What will this key be used for?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <Select value={scopes} onValueChange={setScopes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="read,write">Read & Write</SelectItem>
                  <SelectItem value="read,write,admin">Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expires In</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Created Dialog - shows plaintext key ONCE */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This is the only time you will see this key. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <p className="font-medium">{createdKey.name}</p>
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input readOnly value={createdKey.plainTextKey} className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdKey.plainTextKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>I&apos;ve saved the key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
