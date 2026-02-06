"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Shield, Users, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { AppUser, ListUsersResult, RoleInfo } from "@/lib/types";
import { toast } from "sonner";

const statusBadgeClass: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Inactive: "bg-gray-100 text-gray-600",
  Locked: "bg-red-100 text-red-800",
  Invited: "bg-blue-100 text-blue-800",
};

const roleBadgeClass: Record<string, string> = {
  Admin: "bg-red-100 text-red-800",
  Manager: "bg-purple-100 text-purple-800",
  Supervisor: "bg-amber-100 text-amber-800",
  User: "bg-blue-100 text-blue-800",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  
  // Role management dialog state
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Role removal confirmation dialog state
  const [roleToRemove, setRoleToRemove] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      if (search.trim()) params.set("search", search.trim());

      const result = await api<ListUsersResult>(`/api/users?${params.toString()}`);
      setUsers(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  const fetchRoles = useCallback(async () => {
    try {
      const result = await api<RoleInfo[]>("/api/users/roles");
      setRoles(result);
    } catch {
      // Roles are optional, don't show error
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
    }
  }, [isAdmin, fetchRoles]);

  useEffect(() => {
    if (isAdmin) {
      const debounce = setTimeout(fetchUsers, 300);
      return () => clearTimeout(debounce);
    }
  }, [isAdmin, fetchUsers]);

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    setIsUpdating(true);
    try {
      const result = await api<{ roles: string[] }>(
        `/api/users/${selectedUser.id}/roles`,
        {
          method: "POST",
          body: { role: selectedRole },
        }
      );
      
      // Update user in list
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { ...u, roles: result.roles }
          : u
      ));
      setSelectedUser(prev => prev ? { ...prev, roles: result.roles } : null);
      
      toast.success(`Role "${selectedRole}" assigned successfully`);
      setSelectedRole("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to assign role";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const promptRemoveRole = (role: string) => {
    // Prevent self-demotion
    if (selectedUser?.id === currentUser?.id && role === "Admin") {
      toast.error("You cannot remove your own Admin role");
      return;
    }
    setRoleToRemove(role);
    setConfirmRemoveOpen(true);
  };

  const handleRemoveRole = async () => {
    if (!selectedUser || !roleToRemove) return;
    
    setIsUpdating(true);
    try {
      const result = await api<{ roles: string[] }>(
        `/api/users/${selectedUser.id}/roles/${roleToRemove}`,
        { method: "DELETE" }
      );
      
      // Update user in list
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { ...u, roles: result.roles }
          : u
      ));
      setSelectedUser(prev => prev ? { ...prev, roles: result.roles } : null);
      
      toast.success(`Role "${roleToRemove}" removed successfully`);
      setConfirmRemoveOpen(false);
      setRoleToRemove(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to remove role";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const openRoleDialog = (user: AppUser) => {
    setSelectedUser(user);
    setSelectedRole("");
    setRoleDialogOpen(true);
  };

  // Calculate stats
  const adminCount = users.filter(u => u.roles.includes("Admin")).length;
  const activeCount = users.filter(u => u.status === "Active").length;

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and their roles within your organization
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label>Search</Label>
            <Input
              placeholder="Name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">Active Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{adminCount}</div>
              <p className="text-xs text-muted-foreground">Administrators</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["User", "Roles", "Status", "Created", "Last Login", "Actions"]}
                  rows={5}
                />
              </div>
            </>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description="Users will appear here after registration."
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={statusBadgeClass[user.status] || ""}
                      >
                        {user.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge
                          key={role}
                          variant="secondary"
                          className={roleBadgeClass[role] || "bg-gray-100"}
                        >
                          {role}
                        </Badge>
                      ))}
                      {user.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Last login: {formatDateTime(user.lastLoginAt)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRoleDialog(user)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Roles
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{user.fullName}</span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge
                                key={role}
                                variant="secondary"
                                className={roleBadgeClass[role] || "bg-gray-100"}
                              >
                                {role}
                              </Badge>
                            ))}
                            {user.roles.length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusBadgeClass[user.status] || ""}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRoleDialog(user)}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Manage Roles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Role Management Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              {selectedUser?.fullName} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current Roles */}
            <div className="space-y-2">
              <Label>Current Roles</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUser?.roles.map((role) => (
                  <Badge
                    key={role}
                    variant="secondary"
                    className={`${roleBadgeClass[role] || "bg-gray-100"} flex items-center gap-1`}
                  >
                    {role}
                    <button
                      className="ml-1 hover:opacity-70 disabled:opacity-50"
                      onClick={() => promptRemoveRole(role)}
                      disabled={isUpdating || (selectedUser?.id === currentUser?.id && role === "Admin")}
                      aria-label={selectedUser?.id === currentUser?.id && role === "Admin" 
                        ? "Cannot remove own Admin role" 
                        : `Remove ${role} role`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedUser?.roles.length === 0 && (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>

            {/* Add Role */}
            <div className="space-y-2">
              <Label>Add Role</Label>
              <div className="flex gap-2">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter(r => !selectedUser?.roles.includes(r.name))
                      .map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          <div className="flex flex-col">
                            <span>{role.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignRole}
                  disabled={!selectedRole || isUpdating}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Removal Confirmation Dialog */}
      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={(open) => {
          setConfirmRemoveOpen(open);
          if (!open) setRoleToRemove(null);
        }}
        title="Remove Role"
        description={`Are you sure you want to remove the "${roleToRemove}" role from ${selectedUser?.fullName}?`}
        confirmLabel="Remove Role"
        cancelLabel="Cancel"
        onConfirm={handleRemoveRole}
        isLoading={isUpdating}
        loadingText="Removing..."
        variant="warning"
      />
    </div>
  );
}
