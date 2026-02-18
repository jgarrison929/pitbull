"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createRole, deleteRole, listRoles, type RoleListItem } from "@/lib/rbac-api";
import { Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/use-require-admin";

export default function RolesPage() {
  const { isAdmin } = useRequireAdmin();
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchRoles = useCallback(async () => {
    try {
      const data = await listRoles();
      setRoles(data);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  async function onCreateRole() {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setIsCreating(true);
    try {
      await createRole({ name: name.trim(), description: description.trim() || null });
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success("Role created");
      await fetchRoles();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create role");
    } finally {
      setIsCreating(false);
    }
  }

  async function onDeleteRole(role: RoleListItem) {
    if (role.isSystem) {
      toast.error("System roles cannot be deleted");
      return;
    }

    if (!confirm(`Delete role \"${role.name}\"?`)) {
      return;
    }

    try {
      await deleteRole(role.id);
      toast.success("Role deleted");
      await fetchRoles();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete role");
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Roles" }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Role-Based Access Control</h1>
          <p className="text-muted-foreground">Manage tenant roles, permissions, and assignments.</p>
        </div>
        <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Built-in roles are locked and cannot be deleted.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading roles...</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{role.description || "-"}</TableCell>
                    <TableCell>{role.userCount}</TableCell>
                    <TableCell>{role.permissionCount}</TableCell>
                    <TableCell>
                      {role.isSystem ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          System
                        </Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/roles/${role.id}`}>Open</Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={role.isSystem}
                          onClick={() => onDeleteRole(role)}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>Create a custom role and then configure its permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Estimator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can review bids and export reports"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreateRole} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
