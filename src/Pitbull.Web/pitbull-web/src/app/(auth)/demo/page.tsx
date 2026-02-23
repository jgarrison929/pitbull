"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/config";
import { setToken, setRefreshToken } from "@/lib/auth";

const ROLES = [
  { value: "ceo", label: "CEO / Executive" },
  { value: "cfo", label: "CFO / Controller" },
  { value: "pm", label: "Project Manager" },
  { value: "field-engineer", label: "Field Engineer" },
  { value: "estimator", label: "Estimator" },
  { value: "ap-clerk", label: "AP / AR Clerk" },
  { value: "hr-manager", label: "HR Manager" },
  { value: "it-admin", label: "IT Administrator" },
];

const COMPANIES = [
  { value: "01", label: "Summit Builders Group (Commercial GC)" },
  { value: "02", label: "Summit Water Infrastructure (Civil GC)" },
  { value: "03", label: "Summit Highway Division (Highway)" },
  { value: "04", label: "Summit Electric Co. (Electrical Sub)" },
];

export default function DemoSignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("pm");
  const [companyCode, setCompanyCode] = useState("01");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/demo-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password, role, companyCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        toast.error(data.error || "Registration failed");
        setIsLoading(false);
        return;
      }

      // Auto-login: store tokens and redirect
      setToken(data.token);
      if (data.refreshToken) setRefreshToken(data.refreshToken);

      toast.success("Welcome to the Pitbull demo!");
      // Force a full page load so auth context picks up the new token
      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-xl shadow-lg">
                P
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Pitbull</h2>
                <p className="text-amber-100 text-xs tracking-widest uppercase">Construction Solutions</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              Try it free.<br />
              No credit card.
            </h1>
            <p className="text-amber-100 text-lg max-w-md leading-relaxed">
              Pick a role, pick a company, and explore the full platform with realistic demo data.
              See exactly how Pitbull handles projects, billing, payroll, and more.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <div className="text-center">
                <div className="text-3xl font-bold">8</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Roles</div>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-3xl font-bold">4</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Companies</div>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-3xl font-bold">100+</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Features</div>
              </div>
            </div>
          </div>

          <p className="text-amber-200/60 text-sm">
            &copy; {new Date().getFullYear()} Pitbull Construction Solutions
          </p>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-lg shadow-md">
                P
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold tracking-tight">Pitbull</h2>
                <p className="text-muted-foreground text-xs tracking-widest uppercase">Construction Solutions</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Try the Demo</h1>
            <p className="text-muted-foreground mt-1">Create a free demo account to explore the platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-10"
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="h-10"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="demoEmail">Email</Label>
              <Input
                id="demoEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
                placeholder="jane@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="demoPassword">Password</Label>
              <Input
                id="demoPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-10"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={companyCode} onValueChange={setCompanyCode}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <LoadingButton
              type="submit"
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-sm"
              loading={isLoading}
              loadingText="Creating account..."
            >
              Start Demo
            </LoadingButton>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-600 dark:text-amber-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
