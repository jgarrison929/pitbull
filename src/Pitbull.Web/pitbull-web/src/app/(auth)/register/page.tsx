"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  UserPlus,
  Building2,
  Users,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Account", icon: UserPlus },
  { id: 2, label: "Company", icon: Building2 },
  { id: 3, label: "Invite Team", icon: Users },
] as const;

const INDUSTRY_TYPES = [
  "General Contractor",
  "Specialty Contractor",
  "Design-Build",
  "Construction Management",
  "Residential Builder",
  "Heavy/Civil",
  "Industrial",
  "Other",
];

const EMPLOYEE_RANGES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
];

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const capped = Math.min(score, 4);
  const levels: Record<number, { label: string; color: string }> = {
    0: { label: "Very weak", color: "bg-red-500" },
    1: { label: "Weak", color: "bg-orange-500" },
    2: { label: "Fair", color: "bg-yellow-500" },
    3: { label: "Good", color: "bg-lime-500" },
    4: { label: "Strong", color: "bg-green-500" },
  };

  return { score: capped, ...levels[capped] };
}

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

  // Step 1 - Account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Step 2 - Company
  const [companyName, setCompanyName] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [employeeRange, setEmployeeRange] = useState("");

  // Step 3 - Invite
  const [inviteEmails, setInviteEmails] = useState(["", "", ""]);

  // Form state
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword === "" || password === confirmPassword;

  const isStep1Valid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 8 &&
    password === confirmPassword &&
    acceptTerms;

  const isStep2Valid = companyName.trim() !== "";

  const goNext = useCallback(() => {
    setSlideDirection("right");
    setStep((s) => Math.min(s + 1, 3));
    setError("");
  }, []);

  const goBack = useCallback(() => {
    setSlideDirection("left");
    setStep((s) => Math.max(s - 1, 1));
    setError("");
  }, []);

  const updateInviteEmail = (index: number, value: string) => {
    setInviteEmails((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addInviteSlot = () => {
    if (inviteEmails.length < 10) {
      setInviteEmails((prev) => [...prev, ""]);
    }
  };

  async function handleSubmit() {
    setError("");
    setIsLoading(true);

    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        companyName: companyName || undefined,
      });

      // TODO: Send invite emails from inviteEmails (non-empty ones)
      toast.success("Account created! Welcome to Pitbull.");
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-2/5 relative bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 overflow-hidden">
        {/* Blueprint grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-xl shadow-lg">
              P
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Pitbull</h2>
              <p className="text-amber-100 text-xs tracking-widest uppercase">Construction Solutions</p>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-bold leading-tight">
              Get up and running<br />
              in minutes.
            </h1>
            <ul className="space-y-3 text-amber-100">
              <li className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </div>
                No per-seat licensing fees
              </li>
              <li className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </div>
                Self-hosted — your data, your servers
              </li>
              <li className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </div>
                Projects, bids, time tracking & more
              </li>
            </ul>
          </div>

          <p className="text-amber-200/60 text-sm">
            © {new Date().getFullYear()} Pitbull Construction Solutions
          </p>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-12 py-8">
        <div
          className={`w-full max-w-lg mx-auto transition-all duration-700 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
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

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              const StepIcon = s.icon;
              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                          ? "bg-amber-500 text-white shadow-md"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium hidden sm:block ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-8 sm:w-12 h-px mx-2 transition-colors duration-300 ${
                        step > s.id ? "bg-green-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Label */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
              Step {step} of 3
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {step === 1 && "Create your account"}
              {step === 2 && "Company details"}
              {step === 3 && "Invite your team"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {step === 1 && "Set up your login credentials"}
              {step === 2 && "Tell us about your company"}
              {step === 3 && "Get your team on board (optional)"}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2 mb-4">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Step Content */}
          <div
            key={step}
            className={`transition-all duration-300 ease-out ${
              slideDirection === "right"
                ? "animate-[slideInRight_0.3s_ease-out]"
                : "animate-[slideInLeft_0.3s_ease-out]"
            }`}
          >
            {/* Step 1: Account */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                </div>

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
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
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
                  {/* Strength Indicator */}
                  {password && (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                              level <= strength.score ? strength.color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{strength.label}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {PASSWORD_RULES.map((rule) => {
                          const passes = rule.test(password);
                          return (
                            <div key={rule.label} className="flex items-center gap-1.5 text-xs">
                              {passes ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className={passes ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                                {rule.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className={`h-11 ${
                      !passwordsMatch ? "border-red-500 focus-visible:ring-red-500" : ""
                    }`}
                  />
                  {!passwordsMatch && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link href="#" className="text-amber-600 dark:text-amber-400 hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="text-amber-600 dark:text-amber-400 hover:underline">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>

                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!isStep1Valid}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2: Company */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name *</Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Construction Co."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industryType">Industry type</Label>
                  <Select value={industryType} onValueChange={setIndustryType}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select your specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employeeRange">Number of employees</Label>
                  <Select value={employeeRange} onValueChange={setEmployeeRange}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_RANGES.map((range) => (
                        <SelectItem key={range} value={range}>
                          {range} employees
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="flex-1 h-11"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goNext}
                    disabled={!isStep2Valid}
                    className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Invite Team */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 border p-4 text-sm text-muted-foreground">
                  Invite teammates to join your workspace. They&apos;ll receive an email invitation.
                  You can always add more people later.
                </div>

                <div className="space-y-3">
                  {inviteEmails.map((inviteEmail, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder={`teammate${index + 1}@company.com`}
                        value={inviteEmail}
                        onChange={(e) => updateInviteEmail(index, e.target.value)}
                        className="h-11"
                      />
                      {index >= 3 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          onClick={() =>
                            setInviteEmails((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {inviteEmails.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addInviteSlot}
                    className="text-xs"
                  >
                    + Add another
                  </Button>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="flex-1 h-11"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <LoadingButton
                    type="button"
                    onClick={handleSubmit}
                    loading={isLoading}
                    loadingText="Creating account..."
                    className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
                  >
                    Create Account
                  </LoadingButton>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Skip — I&apos;ll invite people later
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-600 dark:text-amber-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Slide animations */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
