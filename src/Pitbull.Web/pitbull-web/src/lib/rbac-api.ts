import api from "@/lib/api";

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

export interface PermissionItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

export interface PermissionCategory {
  category: string;
  permissions: PermissionItem[];
}

export interface AssignedUser {
  id: string;
  fullName: string;
  email: string;
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string | null;
  permissions: PermissionItem[];
  assignedUsers: AssignedUser[];
}

export interface ListUsersResult {
  items: Array<{
    id: string;
    fullName: string;
    email: string;
  }>;
}

export async function listRoles() {
  return api<RoleListItem[]>("/api/roles");
}

export async function getRole(id: string) {
  return api<RoleDetail>(`/api/roles/${id}`);
}

export async function createRole(payload: { name: string; description?: string | null }) {
  return api<RoleDetail>("/api/roles", {
    method: "POST",
    body: payload,
  });
}

export async function updateRole(id: string, payload: { name: string; description?: string | null }) {
  return api<RoleDetail>(`/api/roles/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteRole(id: string) {
  return api<void>(`/api/roles/${id}`, { method: "DELETE" });
}

export async function listPermissionCategories() {
  return api<PermissionCategory[]>("/api/permissions");
}

export async function assignPermissions(roleId: string, permissionIds: string[]) {
  return api<RoleDetail>(`/api/roles/${roleId}/permissions`, {
    method: "POST",
    body: { permissionIds },
  });
}

export async function removePermissions(roleId: string, permissionIds: string[]) {
  return api<RoleDetail>(`/api/roles/${roleId}/permissions`, {
    method: "DELETE",
    body: { permissionIds },
  });
}

export async function assignUserRole(userId: string, roleId: string) {
  return api<void>(`/api/users/${userId}/roles`, {
    method: "POST",
    body: { roleId },
  });
}

export async function listAssignableUsers() {
  return api<ListUsersResult>("/api/users?pageSize=200");
}
