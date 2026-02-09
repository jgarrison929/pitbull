"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { LoadingButton } from "@/components/ui/loading-button";
import { Edit, Users, Search } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { AdminUser, AdminListUsersResult, RoleInfo, UserStatus } from "@/lib/types";
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

const statusOptions: UserStatus[] = ["Active", "Inactive", "Locked", "Invited"];

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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  
  // Edit modal state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    status: "" as UserStatus | "",
    roles: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);

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
      if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

      const result = await api<AdminListUsersResult>(`/api/admin/users?${params.toString()}`);
      setUsers(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  const fetchRoles = useCallback(async () => {
    try {
      const result = await api<RoleInfo[]>("/api/admin/users/roles");
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

  const openEditDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: [...user.roles],
    });
    setEditDialogOpen(true);
  };

  const handleRoleToggle = (role: string, checked: boolean) => {
    // Prevent self-demotion from Admin
    if (selectedUser?.id === currentUser?.id && role === "Admin" && !checked) {
      toast.error("You cannot remove your own Admin role");
      return;
    }
    
    setEditForm(prev => ({
      ...prev,
      roles: checked
        ? [...prev.roles, role]
        : prev.roles.filter(r => r !== role),
    }));
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    setIsSaving(true);
    try {
      const updatedUser = await api<AdminUser>(
        `/api/admin/users/${selectedUser.id}`,
        {
          method: "PUT",
          body: {
            firstName: editForm.firstName,
            lastName: editForm.lastName,
            status: editForm.status,
            roles: editForm.roles,
          },
        }
      );
      
      // Update user in list
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id ? updatedUser : u
      ));
      
      toast.success("User updated successfully");
      setEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update user";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
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
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              description={search || roleFilter || statusFilter 
                ? "Try adjusting your filters." 
                : "Users will appear here after registration."}
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
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
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
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
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

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Name Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={editForm.status} 
                onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value as UserStatus }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Roles */}
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="border rounded-md p-3 space-y-3">
                {roles.map((role) => {
                  const isChecked = editForm.roles.includes(role.name);
                  const isSelfAdmin = selectedUser?.id === currentUser?.id && role.name === "Admin";
                  
                  return (
                    <div key={role.name} className="flex items-start space-x-3">
                      <Checkbox
                        id={`role-${role.name}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => handleRoleToggle(role.name, !!checked)}
                        disabled={isSelfAdmin && isChecked}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <label
                          htmlFor={`role-${role.name}`}
                          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                            isSelfAdmin && isChecked ? "opacity-70" : ""
                          }`}
                        >
                          {role.name}
                          {isSelfAdmin && isChecked && (
                            <span className="text-xs text-muted-foreground ml-2">(cannot remove own Admin)</span>
                          )}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              onClick={handleSaveUser}
              loading={isSaving}
              loadingText="Saving..."
              className="bg-amber-500 hover:bg-amber-600"
            >
              Save Changes
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
