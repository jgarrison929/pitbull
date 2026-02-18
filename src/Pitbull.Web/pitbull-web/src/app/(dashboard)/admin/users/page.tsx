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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Users, Search, UserPlus, Mail, Trash2, RotateCw } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { AdminUser, AdminListUsersResult, RoleInfo, UserStatus, TeamInvitation } from "@/lib/types";
import { toast } from "sonner";

const statusBadgeClass: Record<string, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  Inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  Locked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  Invited: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
};

const roleBadgeClass: Record<string, string> = {
  Admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  Manager: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  Supervisor: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  User: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  Viewer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
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

  // Invite modal state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [isInviting, setIsInviting] = useState(false);

  // Invitations state
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

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

  const fetchInvitations = useCallback(async () => {
    setIsLoadingInvitations(true);
    try {
      const result = await api<TeamInvitation[]>("/api/invitation");
      setInvitations(result);
    } catch {
      // Invitations may not be available in all contexts
    } finally {
      setIsLoadingInvitations(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const debounce = setTimeout(fetchUsers, 300);
      return () => clearTimeout(debounce);
    }
  }, [isAdmin, fetchUsers]);

  useEffect(() => {
    if (isAdmin) {
      fetchInvitations();
    }
  }, [isAdmin, fetchInvitations]);

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

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }

    setIsInviting(true);
    try {
      await api("/api/invitation", {
        method: "POST",
        body: { email: inviteEmail.trim(), role: inviteRole },
      });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("Viewer");
      fetchUsers();
      fetchInvitations();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    setRevokingId(id);
    try {
      await api(`/api/invitation/${id}`, { method: "DELETE" });
      toast.success("Invitation revoked");
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to revoke invitation";
      toast.error(message);
    } finally {
      setRevokingId(null);
    }
  };

  const handleResendInvitation = async (id: string) => {
    setResendingId(id);
    try {
      await api(`/api/invitation/${id}/resend`, { method: "POST" });
      toast.success("Invitation resent");
      fetchInvitations();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to resend invitation";
      toast.error(message);
    } finally {
      setResendingId(null);
    }
  };

  // Calculate stats
  const adminCount = users.filter(u => u.roles.includes("Admin")).length;
  const activeCount = users.filter(u => u.status === "Active").length;
  const pendingInvitations = invitations.filter(i => i.status === "Pending");

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
        <Button
          onClick={() => setInviteDialogOpen(true)}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            Users ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="h-4 w-4 mr-1.5" />
            Invitations
            {pendingInvitations.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                {pendingInvitations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6 mt-4">

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

        </TabsContent>

        <TabsContent value="invitations" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingInvitations ? (
                <CardListSkeleton rows={3} />
              ) : invitations.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No invitations"
                  description="Invite users to join your organization using the button above."
                />
              ) : (
                <>
                  {/* Mobile card layout */}
                  <div className="sm:hidden space-y-3">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{inv.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Invited by {inv.invitedBy}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              inv.status === "Pending"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                : inv.status === "Accepted"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                : inv.isExpired
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                            }
                          >
                            {inv.isExpired ? "Expired" : inv.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={roleBadgeClass[inv.role] || "bg-gray-100"}>
                            {inv.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Sent {formatDate(inv.createdAt)}
                          </span>
                        </div>
                        {inv.status === "Pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendInvitation(inv.id)}
                              disabled={resendingId === inv.id}
                            >
                              <RotateCw className={`h-3.5 w-3.5 mr-1 ${resendingId === inv.id ? "animate-spin" : ""}`} />
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              disabled={revokingId === inv.id}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Revoke
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop table layout */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Invited By</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={roleBadgeClass[inv.role] || "bg-gray-100"}>
                                {inv.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  inv.status === "Pending"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                    : inv.status === "Accepted"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                    : inv.isExpired
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                }
                              >
                                {inv.isExpired ? "Expired" : inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{inv.invitedBy}</TableCell>
                            <TableCell>{formatDate(inv.createdAt)}</TableCell>
                            <TableCell>
                              <span className={inv.isExpired ? "text-red-600" : ""}>
                                {formatDate(inv.expiresAt)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {inv.status === "Pending" && (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleResendInvitation(inv.id)}
                                    disabled={resendingId === inv.id}
                                    title="Resend invitation"
                                  >
                                    <RotateCw className={`h-4 w-4 ${resendingId === inv.id ? "animate-spin" : ""}`} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRevokeInvitation(inv.id)}
                                    disabled={revokingId === inv.id}
                                    title="Revoke invitation"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
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
        </TabsContent>
      </Tabs>

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

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) {
          setInviteEmail("");
          setInviteRole("Viewer");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              onClick={handleInviteUser}
              loading={isInviting}
              loadingText="Sending..."
              className="bg-amber-500 hover:bg-amber-600"
            >
              Send Invitation
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
