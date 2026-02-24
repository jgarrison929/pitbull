"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: "Terms of Service" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-amber-500" />
          Terms of Service
        </h1>
        <p className="text-muted-foreground">
          Last updated: February 2026
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Pitbull Construction Solutions, you agree to be bound by
            these terms. If you do not agree, do not use the software.
          </p>

          <h2>2. License</h2>
          <p>
            Pitbull is licensed on a per-organization subscription basis.
            Your subscription grants your organization the right to access and use
            the platform and all included modules.
          </p>

          <h2>3. User Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials,
            ensuring accurate data entry, and complying with applicable labor and construction
            regulations when using the software.
          </p>

          <h2>4. Data Ownership</h2>
          <p>
            All data entered into Pitbull remains the property of your organization. You retain
            full ownership of your data at all times and can export it on request.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            Pitbull Construction Solutions is provided &quot;as is.&quot; We are not liable for
            data loss, inaccurate calculations, or any damages arising from the use of this
            software. Always verify critical financial data independently.
          </p>

          <h2>6. Contact</h2>
          <p>
            For questions about these terms, contact your system administrator or reach out to
            Pitbull support at support@pitbullconstructionsolutions.com.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
