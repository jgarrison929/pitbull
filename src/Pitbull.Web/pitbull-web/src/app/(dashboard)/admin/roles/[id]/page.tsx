"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignPermissions,
  assignUserRole,
  getRole,
  listAssignableUsers,
  listPermissionCategories,
  removePermissions,
  updateRole,
  type PermissionCategory,
  type RoleDetail,
} from "@/lib/rbac-api";
import { Lock, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roleId = params.id;

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isSavingPermission, setIsSavingPermission] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isAssigningUser, setIsAssigningUser] = useState(false);

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const [roleResult, permissionResult, usersResult] = await Promise.all([
        getRole(roleId),
        listPermissionCategories(),
        listAssignableUsers(),
      ]);

      setRole(roleResult);
      setName(roleResult.name);
      setDescription(roleResult.description || "");
      setCategories(permissionResult);
      setAllUsers(usersResult.items);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load role");
      router.push("/admin/roles");
    } finally {
      setIsLoading(false);
    }
  }, [roleId, router]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const assignedPermissionIds = useMemo(() => {
    return new Set(role?.permissions.map((p) => p.id) ?? []);
  }, [role]);

  const assignedUserIds = useMemo(() => {
    return new Set(role?.assignedUsers.map((u) => u.id) ?? []);
  }, [role]);

  const availableUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    return allUsers
      .filter((user) => !assignedUserIds.has(user.id))
      .filter((user) => {
        if (!query) return true;
        return (
          user.fullName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        );
      });
  }, [allUsers, assignedUserIds, userSearch]);

  async function onSaveRole() {
    if (!role) return;
    if (role.isSystem) {
      toast.error("System roles cannot be edited");
      return;
    }

    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setIsSavingRole(true);
    try {
      const updated = await updateRole(role.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setRole(updated);
      toast.success("Role updated");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setIsSavingRole(false);
    }
  }

  async function onTogglePermission(permissionId: string, checked: boolean) {
    if (!role) return;
    if (role.isSystem) {
      toast.error("System role permissions are read-only");
      return;
    }

    setIsSavingPermission(true);
    try {
      const updated = checked
        ? await assignPermissions(role.id, [permissionId])
        : await removePermissions(role.id, [permissionId]);

      setRole(updated);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update permission");
    } finally {
      setIsSavingPermission(false);
    }
  }

  async function onAssignUser() {
    if (!role || !selectedUserId) return;

    setIsAssigningUser(true);
    try {
      await assignUserRole(selectedUserId, role.id);
      toast.success("Role assigned to user");
      setAssignOpen(false);
      setSelectedUserId("");
      setUserSearch("");
      await loadPage();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to assign role");
    } finally {
      setIsAssigningUser(false);
    }
  }

  if (isLoading || !role) {
    return <p className="py-8 text-sm text-muted-foreground">Loading role...</p>;
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Admin" },
          { label: "Roles", href: "/admin/roles" },
          { label: role.name },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
          <p className="text-muted-foreground">Configure role details, users, and permission matrix.</p>
        </div>
        {role.isSystem && (
          <Badge variant="secondary" className="w-fit gap-1">
            <Lock className="h-3 w-3" />
            System role
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Role info and users</CardTitle>
            <CardDescription>Update role metadata and assign users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={name}
                disabled={role.isSystem}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                disabled={role.isSystem}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button onClick={onSaveRole} disabled={role.isSystem || isSavingRole}>
              {isSavingRole ? "Saving..." : "Save role"}
            </Button>

            <div className="space-y-3 border-t pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Assigned users ({role.assignedUsers.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign user
                </Button>
              </div>
              <div className="space-y-2">
                {role.assignedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No users assigned.</p>
                ) : (
                  role.assignedUsers.map((user) => (
                    <div key={user.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permission matrix</CardTitle>
            <CardDescription>
              Permissions are grouped by module category. System role permissions are read-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {categories.map((category) => (
              <div key={category.category} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {category.category}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {category.permissions.map((permission) => {
                    const checked = assignedPermissionIds.has(permission.id);

                    return (
                      <label
                        key={permission.id}
                        className="flex items-center gap-3 rounded-md border p-3 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={role.isSystem || isSavingPermission}
                          onCheckedChange={(value) => onTogglePermission(permission.id, !!value)}
                        />
                        <div>
                          <p className="font-medium">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">{permission.description || "-"}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign user to role</DialogTitle>
            <DialogDescription>Search users and assign this role.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-search">Search user</Label>
              <Input
                id="user-search"
                placeholder="Type name or email"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No matching users
                    </SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onAssignUser} disabled={!selectedUserId || isAssigningUser}>
              {isAssigningUser ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
