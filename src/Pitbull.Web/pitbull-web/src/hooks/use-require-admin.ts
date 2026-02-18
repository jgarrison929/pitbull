"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export function useRequireAdmin() {
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, isAuthenticated, router]);

  return { isAdmin };
}
