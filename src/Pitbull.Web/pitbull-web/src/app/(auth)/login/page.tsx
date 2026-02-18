"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    // Restore remembered email
    const savedEmail = localStorage.getItem("pitbull_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setShake(false);

    try {
      await login(email, password);

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem("pitbull_remember_email", email);
      } else {
        localStorage.removeItem("pitbull_remember_email");
      }

      toast.success("Welcome back!");
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid email or password";
      setError(message);
      setShake(true);
      toast.error(message);
      setTimeout(() => setShake(false), 650);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 overflow-hidden">
        {/* Blueprint grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Diagonal construction stripes (subtle) */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(0,0,0,1) 20px, rgba(0,0,0,1) 22px)",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            {/* Logo */}
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
              Build smarter.<br />
              Manage better.
            </h1>
            <p className="text-amber-100 text-lg max-w-md leading-relaxed">
              Project management, bidding, time tracking, and cost control — all in one platform
              built for commercial general contractors.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <div className="text-center">
                <div className="text-3xl font-bold">100%</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Self-hosted</div>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-3xl font-bold">$0</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Per seat fees</div>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-3xl font-bold">∞</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Users</div>
              </div>
            </div>
          </div>

          <p className="text-amber-200/60 text-sm">
            © {new Date().getFullYear()} Pitbull Construction Solutions
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
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

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Banner */}
            {error && (
              <div
                className={`rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2 ${
                  shake ? "animate-[shake_0.6s_ease-in-out]" : ""
                }`}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                Remember me
              </Label>
            </div>

            <LoadingButton
              type="submit"
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-sm"
              loading={isLoading}
              loadingText="Signing in..."
            >
              Sign In
            </LoadingButton>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-amber-600 dark:text-amber-400 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Shake keyframe animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
