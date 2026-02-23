"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: "Privacy Policy" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-500" />
          Privacy Policy
        </h1>
        <p className="text-muted-foreground">
          Last updated: February 2026
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
          <h2>1. Information We Collect</h2>
          <p>
            Pitbull Construction Solutions is a self-hosted application. All data is stored on
            your organization&apos;s own infrastructure. We do not collect, transmit, or store
            any of your data on external servers.
          </p>

          <h2>2. How Your Data Is Used</h2>
          <p>
            Data entered into Pitbull is used solely to provide the construction management
            features you use: project tracking, time entry, reporting, and related functions.
            Your data remains within your organization&apos;s database at all times.
          </p>

          <h2>3. Data Security</h2>
          <p>
            As a self-hosted solution, data security is managed by your organization&apos;s IT
            infrastructure. Pitbull employs encryption in transit (TLS), role-based access
            control, and row-level security at the database level to protect tenant data.
          </p>

          <h2>4. Third-Party Services</h2>
          <p>
            Pitbull does not share your data with third parties. Optional integrations
            (e.g., Vista export) generate files locally that you control.
          </p>

          <h2>5. Contact</h2>
          <p>
            For privacy questions, contact your system administrator or reach out to
            Pitbull support at support@pitbullconstructionsolutions.com.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
