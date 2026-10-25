"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail(email.trim())) {
      return;
    }

    setIsLoading(true);

    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
    } catch {
      // Silently handle — we always show the same message to prevent email enumeration
    } finally {
      setSubmitted(true);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {submitted ? "Check your email" : "Reset your password"}
          </CardTitle>
          <CardDescription>
            {submitted
              ? `We sent a reset link to ${email}`
              : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-center">
                If an account exists with that email, you&apos;ll receive a password reset link shortly.
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <LoadingButton
                type="submit"
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
                loading={isLoading}
                loadingText="Sending..."
              >
                Send Reset Link
              </LoadingButton>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
