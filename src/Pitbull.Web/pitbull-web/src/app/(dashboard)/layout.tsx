"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { KeyboardShortcutsProvider } from "@/contexts/keyboard-shortcuts-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { CommandPalette } from "@/components/command-palette";
import { QuickActionFAB } from "@/components/layout/quick-action-fab";
import { AiChatPanel } from "@/components/ai-chat-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <KeyboardShortcutsProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <main className="flex-1 p-4 lg:p-6 bg-muted/30">
            <ErrorBoundary section="Dashboard">
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <KeyboardShortcutsHelp />
      <CommandPalette />
      <QuickActionFAB />

      <AiChatPanel />
    </KeyboardShortcutsProvider>
  );
}
