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
import { FeedbackWidget } from "@/components/layout/feedback-widget";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { DemoBanner } from "@/components/layout/demo-banner";
import {
  DASHBOARD_CONTENT_COLUMN,
  MOBILE_MAIN_BOTTOM_CLEARANCE,
} from "@/components/layout/mobile-shell";

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
      <DemoBanner />
      <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden">
        <AppSidebar />
        <div className={DASHBOARD_CONTENT_COLUMN}>
          <AppHeader />
          <main
            className={`flex-1 min-w-0 p-4 lg:p-6 bg-muted/30 ${MOBILE_MAIN_BOTTOM_CLEARANCE}`}
          >
            <ErrorBoundary section="Dashboard">
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <KeyboardShortcutsHelp />
      <CommandPalette />
      <QuickActionFAB />
      <FeedbackWidget />
      <WelcomeTour />

      <AiChatPanel />
      <MobileBottomNav />
    </KeyboardShortcutsProvider>
  );
}
