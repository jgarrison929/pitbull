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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Pitbull</h1>
          <p className="text-slate-500 mt-1">Construction Solutions</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Account created
          </h2>

          <p className="text-slate-500 mb-6">
            {email ? (
              <>
                Your account for{" "}
                <span className="font-medium text-slate-700">{email}</span>{" "}
                is ready to use.
              </>
            ) : (
              "Your account is ready to use."
            )}
          </p>

          <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>No email verification required — you can sign in now</span>
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
