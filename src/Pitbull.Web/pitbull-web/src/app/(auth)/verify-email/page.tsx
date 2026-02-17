"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Pitbull</h1>
          <p className="text-slate-500 mt-1">Construction Solutions</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>

          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Check your email
          </h2>

          <p className="text-slate-500 mb-6">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-medium text-slate-700">{email}</span>
            ) : (
              "your email address"
            )}
            . Click the link to verify your account.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Email verification is coming soon</span>
            </div>

            <p className="text-xs text-slate-400">
              For now, your account is active immediately. Email verification
              will be enabled in a future update.
            </p>
          </div>

          <div className="mt-6">
            <Link href="/login">
              <Button className="w-full">Continue to Login</Button>
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
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
