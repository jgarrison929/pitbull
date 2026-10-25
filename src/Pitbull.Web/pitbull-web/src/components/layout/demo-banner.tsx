"use client";

import { useAuth } from "@/contexts/auth-context";

export function DemoBanner() {
  const { isDemoUser } = useAuth();

  if (!isDemoUser) return null;

  return (
    <div className="bg-amber-500 text-white text-center text-sm py-1.5 px-4 font-medium">
      Demo mode — explore freely. Admin pages are read-only; data resets periodically.
    </div>
  );
}
