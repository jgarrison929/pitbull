"use client";

import { useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";

export function usePermissions() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  const can = useCallback((permission: string) => {
    if (permissions.has("*")) return true;
    return permissions.has(permission);
  }, [permissions]);

  const canAny = useCallback((perms: string[]) => {
    if (permissions.has("*")) return true;
    return perms.some(p => permissions.has(p));
  }, [permissions]);

  const canAll = useCallback((perms: string[]) => {
    if (permissions.has("*")) return true;
    return perms.every(p => permissions.has(p));
  }, [permissions]);

  const canAccessCategory = useCallback((category: string) => {
    if (permissions.has("*")) return true;
    const prefix = category + ".";
    for (const p of permissions) {
      if (p.startsWith(prefix)) return true;
    }
    return false;
  }, [permissions]);

  return { can, canAny, canAll, canAccessCategory, permissions: [...permissions] };
}
