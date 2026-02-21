import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import { CompanyProvider } from "@/contexts/company-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { Toaster } from "@/components/ui/sonner";
import { RootErrorBoundary } from "@/components/root-error-boundary";
import { GlobalErrorHandlers } from "@/components/global-error-handlers";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pitbull Construction Solutions",
    template: "%s | Pitbull Construction",
  },
  description:
    "Modern construction project management platform. Track time, manage costs, and streamline your construction operations.",
  keywords: [
    "construction management",
    "project management",
    "time tracking",
    "job costing",
    "construction software",
  ],
  authors: [{ name: "Pitbull Construction Solutions" }],
  creator: "Pitbull Construction Solutions",
  publisher: "Pitbull Construction Solutions",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Pitbull Construction Solutions",
    title: "Pitbull Construction Solutions",
    description:
      "Modern construction project management platform. Track time, manage costs, and streamline your construction operations.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pitbull Construction Solutions",
    description:
      "Modern construction project management platform for time tracking and job costing.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RootErrorBoundary>
          <GlobalErrorHandlers />
          <PostHogProvider>
            <ThemeProvider>
              <AuthProvider>
                <CompanyProvider>
                  <TooltipProvider>
                    <ServiceWorkerRegister />
                    <PwaInstallPrompt />
                    {children}
                    <Toaster position="top-right" richColors />
                  </TooltipProvider>
                </CompanyProvider>
              </AuthProvider>
            </ThemeProvider>
          </PostHogProvider>
        </RootErrorBoundary>
      </body>
    </html>
  );
}
