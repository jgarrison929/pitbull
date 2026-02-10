"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { label: "Dashboard", href: "/", icon: "📊" },
  { label: "Projects", href: "/projects", icon: "🏗️" },
  { label: "Bids", href: "/bids", icon: "📋" },
  { label: "Time Tracking", href: "/time-tracking", icon: "⏱️" },
  { label: "Employees", href: "/employees", icon: "👷" },
  { label: "Cost Codes", href: "/cost-codes", icon: "🏷️" },
  { label: "Labor Cost Report", href: "/reports/labor-cost", icon: "💰" },
  { label: "Vista Export", href: "/reports/vista-export", icon: "📤" },
  { label: "Contracts", href: "/contracts", icon: "📄" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
  { label: "Documents", href: "#", icon: "📁", disabled: true },
];

// HR module removed - employees are in TimeTracking module at /employees

const adminItems = [
  { label: "Users", href: "/admin/users", icon: "👥" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📜" },
  { label: "Company Settings", href: "/admin/company", icon: "🏢" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#1a1a2e] text-white min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 font-bold text-lg">
          P
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">Pitbull</h1>
          <p className="text-xs text-neutral-400">Construction Solutions</p>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.disabled
                  ? "text-neutral-500 cursor-not-allowed"
                  : isActive
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-neutral-300 hover:bg-white/5 hover:text-white"
              )}
              onClick={item.disabled ? (e) => e.preventDefault() : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.disabled && (
                <span className="ml-auto text-[10px] uppercase tracking-wider text-neutral-600 bg-white/5 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </Link>
          );
        })}

        {/* HR Section removed - employees are in TimeTracking module */}

        {/* Admin Section - Only visible to admins */}
        {user?.roles?.includes("Admin") && (
          <>
            <div className="pt-4 pb-2">
              <span className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Admin
              </span>
            </div>
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-amber-500/15 text-amber-400"
                      : "text-neutral-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <Separator className="bg-white/10" />

      {/* User Info */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
            <p className="text-xs text-neutral-400 truncate">{user?.email || ""}</p>
          </div>
          <button
            onClick={logout}
            className="text-neutral-400 hover:text-white text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Sign out"
          >
            ↗
          </button>
        </div>
      </div>
    </aside>
  );
}
