"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="min-h-screen flex bg-background items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-lg shadow-md">
              P
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Pitbull
              </h1>
              <p className="text-muted-foreground text-xs tracking-widest uppercase">
                Construction Solutions
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            Account created
          </h2>

          <p className="text-muted-foreground mb-6">
            {email ? (
              <>
                Your account for{" "}
                <span className="font-medium text-foreground">{email}</span>{" "}
                is ready to use.
              </>
            ) : (
              "Your account is ready to use."
            )}
          </p>

          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>No email verification required — you can sign in now</span>
          </div>

          <div className="mt-6">
            <Link href="/login">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                Continue to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
