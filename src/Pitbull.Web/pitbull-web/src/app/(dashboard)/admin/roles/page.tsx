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
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  tenantId: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api<Role[]>("/api/admin/roles");
      setRoles(res);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  // Extract display name from "tenantId:RoleName" format
  function displayName(fullName: string) {
    const parts = fullName.split(":");
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("Role name is required"); return; }
    setIsSaving(true);
    try {
      await api("/api/admin/roles", {
        method: "POST",
        body: { name: name.trim(), description: description || null },
      });
      setCreateOpen(false);
      setName(""); setDescription("");
      fetchRoles();
      toast.success("Role created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editRole) return;
    setIsSaving(true);
    try {
      await api(`/api/admin/roles/${editRole.id}`, {
        method: "PUT",
        body: { description: description || null },
      });
      setEditRole(null);
      setDescription("");
      fetchRoles();
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(role: Role) {
    if (!confirm(`Delete role "${displayName(role.name)}"? Users will lose this role.`)) return;
    try {
      await api(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    }
  }

  function openEdit(role: Role) {
    setEditRole(role);
    setDescription(role.description || "");
  }

  const systemRoles = roles.filter(r => r.isSystemRole);
  const customRoles = roles.filter(r => !r.isSystemRole);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Roles & Permissions" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage user roles and access levels</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" /> Create Role
        </Button>
      </div>

      {/* System Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            System Roles ({systemRoles.length})
          </CardTitle>
          <CardDescription>Built-in roles that cannot be modified or deleted</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : systemRoles.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No system roles found. Run the bootstrap endpoint first.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{displayName(role.name)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{role.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">System</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Custom Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Roles ({customRoles.length})</CardTitle>
          <CardDescription>Roles you&apos;ve created for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {customRoles.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No custom roles yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{displayName(role.name)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{role.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(role)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>Add a new role for your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input placeholder="e.g. Foreman, Estimator, Accountant" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What can users with this role do?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRole} onOpenChange={() => setEditRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role description for &quot;{editRole ? displayName(editRole.name) : ""}&quot;</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
