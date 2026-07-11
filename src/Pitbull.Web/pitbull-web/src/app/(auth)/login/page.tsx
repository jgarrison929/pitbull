"use client";

import { Suspense, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Briefcase,
  Calculator,
  HardHat,
  Landmark,
  Loader2,
  UsersRound,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

type DemoRole = {
  key: string;
  label: string;
  description: string;
  email: string;
};

/** Fallback catalog if GET /api/auth/demo-roles is unavailable (static labels only). */
const FALLBACK_DEMO_ROLES: DemoRole[] = [
  {
    key: "ceo",
    label: "CEO",
    description: "Executive portfolio — financials, risks, pipeline, people",
    email: "ceo@demo.local",
  },
  {
    key: "cfo",
    label: "CFO",
    description: "Financial leadership — WIP, AR/AP aging, accounting",
    email: "cfo@demo.local",
  },
  {
    key: "pm",
    label: "Project Manager",
    description: "Jobs in flight — schedules, RFIs, daily reports",
    email: "pm@demo.local",
  },
  {
    key: "superintendent",
    label: "Superintendent",
    description: "Field leadership — crew time, daily reports, punch lists",
    email: "superintendent@demo.local",
  },
  {
    key: "estimator",
    label: "Estimator",
    description: "Precon focus — bids, pipeline value, cost codes",
    email: "estimator@demo.local",
  },
];

const ROLE_ICONS: Record<string, ReactNode> = {
  ceo: <Briefcase className="h-5 w-5" />,
  cfo: <Landmark className="h-5 w-5" />,
  pm: <HardHat className="h-5 w-5" />,
  superintendent: <UsersRound className="h-5 w-5" />,
  foreman: <UsersRound className="h-5 w-5" />,
  estimator: <Calculator className="h-5 w-5" />,
};

function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  /** Server catalog when available; null until probe finishes or on network error (use fallback). */
  const [demoRoles, setDemoRoles] = useState<DemoRole[] | null>(null);
  /** 'unknown' = still probing or network blip — still show Explore; 'no' = API 404 demo off. */
  const [demoAvailability, setDemoAvailability] = useState<"unknown" | "yes" | "no">("unknown");
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { login, loginAsDemoRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const savedEmail = localStorage.getItem("pitbull_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/demo-roles`);
        if (!res.ok) {
          // 404 = demo disabled; other errors keep fallback visible (mobile networks flake)
          if (!cancelled) {
            setDemoRoles(null);
            setDemoAvailability(res.status === 404 ? "no" : "unknown");
          }
          return;
        }
        const data = (await res.json()) as DemoRole[];
        if (!cancelled) {
          if (Array.isArray(data) && data.length > 0) {
            setDemoRoles(data);
            setDemoAvailability("yes");
          } else {
            setDemoRoles(null);
            setDemoAvailability("no");
          }
        }
      } catch {
        // Offline / CORS / cold start — keep Explore buttons using FALLBACK
        if (!cancelled) {
          setDemoRoles(null);
          setDemoAvailability("unknown");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goAfterLogin = useCallback(() => {
    const redirect = safeRedirect(searchParams.get("redirect"));
    router.push(redirect);
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setShake(false);

    try {
      await login(email, password);

      if (rememberMe) {
        localStorage.setItem("pitbull_remember_email", email);
      } else {
        localStorage.removeItem("pitbull_remember_email");
      }

      toast.success("Welcome back!");
      goAfterLogin();
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

  async function handleDemoRole(roleKey: string, label: string) {
    setError("");
    setActiveRoleKey(roleKey);
    try {
      await loginAsDemoRole(roleKey);
      toast.success(`Signed in as ${label}`);
      goAfterLogin();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Demo login failed. Try again in a moment.";
      setError(message);
      toast.error(message);
    } finally {
      setActiveRoleKey(null);
    }
  }

  // PostHog (14d): ~16/19 mobile users only hit /login — never hide Explore on network flake.
  // Only hide when API explicitly says demo is off (404).
  const showDemoRoles = demoAvailability !== "no";
  const roleButtons = demoRoles ?? FALLBACK_DEMO_ROLES;
  const roleBusy = activeRoleKey !== null || isLoading;

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
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(0,0,0,1) 20px, rgba(0,0,0,1) 22px)",
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
                <p className="text-amber-100 text-xs tracking-widest uppercase">
                  Construction Solutions
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              See the product
              <br />
              through every seat.
            </h1>
            <p className="text-amber-100 text-lg max-w-md leading-relaxed">
              Jump in as a CEO, CFO, PM, Superintendent, or Estimator — realistic projects, bids, and
              billing data, no setup required.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <div className="text-center">
                <div className="text-3xl font-bold">5</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Roles</div>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-3xl font-bold">14</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Modules</div>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-3xl font-bold">AI</div>
                <div className="text-amber-200 text-xs uppercase tracking-wider">Native</div>
              </div>
            </div>
          </div>

          <p className="text-amber-200/60 text-sm">
            © {new Date().getFullYear()} Pitbull Construction Solutions
          </p>
        </div>
      </div>

      {/* Right Panel — mobile: top-align so Explore roles are above the fold */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-5">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-lg shadow-md">
                P
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold tracking-tight">Pitbull</h2>
                <p className="text-muted-foreground text-xs tracking-widest uppercase">
                  Construction Solutions
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {showDemoRoles ? "Try the demo" : "Welcome"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {showDemoRoles
                ? "Tap a role — no account needed. Best on your phone."
                : "Sign in to your account to continue"}
            </p>
          </div>

          {error && (
            <div
              className={`mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2 ${
                shake ? "animate-[shake_0.6s_ease-in-out]" : ""
              }`}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Demo role one-click login — always enabled (PostHog: buttons were disabled while catalog loaded) */}
          {showDemoRoles && (
            <div className="mb-5 sm:mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Explore as a role</p>
                {demoAvailability === "unknown" && (
                  <span className="text-[10px] text-muted-foreground">Live demo</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {roleButtons.map((role) => {
                  const busy = activeRoleKey === role.key;
                  return (
                    <button
                      key={role.key}
                      type="button"
                      disabled={roleBusy}
                      onClick={() => handleDemoRole(role.key, role.label)}
                      className="group text-left rounded-xl border-2 border-amber-500/40 bg-card p-3 sm:p-4 shadow-sm transition-all hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed min-h-[72px] touch-manipulation"
                    >
                      <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                          {busy ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            ROLE_ICONS[role.key] ?? <Briefcase className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm tracking-tight">{role.label}</div>
                          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2 hidden xs:block sm:block">
                            {role.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Shared demo data · tap a role to go straight in
              </p>
            </div>
          )}

          {showDemoRoles && (
            <div className="relative my-4 sm:my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <button
                  type="button"
                  className="bg-background px-2 text-muted-foreground hover:text-foreground sm:pointer-events-none"
                  onClick={() => setShowEmailForm((v) => !v)}
                >
                  {showEmailForm ? "hide email sign-in" : "or sign in with email"}
                </button>
              </div>
            </div>
          )}

          {/* Email form: collapsed by default on mobile when demo is available (PostHog bounce fix) */}
          <form
            onSubmit={handleSubmit}
            className={`space-y-5 ${
              showDemoRoles && !showEmailForm ? "hidden sm:block" : ""
            }`}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!(showDemoRoles && !showEmailForm)}
                autoComplete="email"
                className="h-11 min-h-[44px]"
                disabled={activeRoleKey !== null}
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
                  disabled={activeRoleKey !== null}
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
                disabled={activeRoleKey !== null}
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
              disabled={activeRoleKey !== null}
            >
              Sign In
            </LoadingButton>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-4px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(4px);
          }
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
