"use client";

import { useState } from "react";
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
  Mail,
  Trash2,
} from "lucide-react";
import api from "@/lib/api";
import { buildOwnerRegisterPayload } from "@/lib/owner-register-payload";

const STEPS = [
  { id: 1, label: "Account", icon: UserPlus },
  { id: 2, label: "Company", icon: Building2 },
  { id: 3, label: "Invite Team", icon: Users },
] as const;

const INDUSTRY_TYPES = [
  { value: "general-contractor", label: "General Contractor" },
  { value: "specialty-contractor", label: "Specialty Contractor" },
  { value: "design-build", label: "Design-Build" },
  { value: "cm-at-risk", label: "Construction Management (CM at Risk)" },
  { value: "owner-builder", label: "Owner-Builder" },
  { value: "other", label: "Other" },
];

const EMPLOYEE_RANGES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
];

interface InviteEntry {
  email: string;
  role: string;
}

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  // Step 1: Account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Step 2: Company
  const [companyName, setCompanyName] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [employeeRange, setEmployeeRange] = useState("");

  // Step 3: Invitations
  const [invites, setInvites] = useState<InviteEntry[]>([
    { email: "", role: "Viewer" },
  ]);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isStep1Valid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    Object.values(passwordChecks).every(Boolean) &&
    password === confirmPassword &&
    agreedToTerms;

  const isStep2Valid = companyName.trim() !== "";

  function addInvite() {
    if (invites.length >= 10) return;
    setInvites([...invites, { email: "", role: "Viewer" }]);
  }

  function removeInvite(index: number) {
    setInvites(invites.filter((_, i) => i !== index));
  }

  function updateInvite(index: number, field: keyof InviteEntry, value: string) {
    const updated = [...invites];
    updated[index] = { ...updated[index], [field]: value };
    setInvites(updated);
  }

  async function handleSubmit() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await register(
        buildOwnerRegisterPayload({
          firstName,
          lastName,
          email,
          password,
          companyName,
          industryType,
          employeeRange,
        })
      );

      // Send invitations (non-blocking — if they fail, the signup still succeeds)
      const validInvites = invites.filter((inv) => inv.email.trim() !== "");
      if (validInvites.length > 0) {
        try {
          await api("/api/invitation/bulk", {
            method: "POST",
            body: {
              invitations: validInvites.map((inv) => ({
                email: inv.email.trim(),
                role: inv.role,
              })),
            },
          });
          toast.success(`Sent ${validInvites.length} invitation(s)`);
        } catch {
          toast.info("Invitations will be sent once your account is set up");
        }
      }

      toast.success("Account created! Welcome to Pitbull.");
      router.push("/settings/company/setup");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Pitbull</h1>
          <p className="text-slate-500 mt-1">Construction Solutions</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <span className="ml-2 text-sm text-slate-600 hidden sm:inline">
                {s.label}
              </span>
              {s.id < STEPS.length && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    step > s.id ? "bg-blue-600" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Step 1: Account */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Create your account
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@acmeconstruction.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                    {[
                      { key: "length", label: "8+ characters" },
                      { key: "upper", label: "Uppercase" },
                      { key: "lower", label: "Lowercase" },
                      { key: "number", label: "Number" },
                    ].map(({ key, label }) => (
                      <span
                        key={key}
                        className={`flex items-center gap-1 ${
                          passwordChecks[key as keyof typeof passwordChecks]
                            ? "text-green-600"
                            : "text-slate-400"
                        }`}
                      >
                        {passwordChecks[key as keyof typeof passwordChecks] ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    Passwords don&apos;t match
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(v) => setAgreedToTerms(v === true)}
                />
                <Label htmlFor="terms" className="text-sm text-slate-600">
                  I agree to the Terms of Service and Privacy Policy
                </Label>
              </div>
              <Button
                className="w-full"
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Company */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Set up your company
              </h2>
              <p className="text-sm text-slate-500">
                Tell us about your construction company.
              </p>
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Construction LLC"
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry Type</Label>
                <Select value={industryType} onValueChange={setIndustryType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="employees">Company Size</Label>
                <Select value={employeeRange} onValueChange={setEmployeeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Number of employees" />
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
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!isStep2Valid}
                  onClick={() => setStep(3)}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Invite Team */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Invite your team
              </h2>
              <p className="text-sm text-slate-500">
                Optional: Invite team members to join your workspace. You can
                always do this later.
              </p>
              <div className="space-y-3">
                {invites.map((invite, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        type="email"
                        value={invite.email}
                        onChange={(e) =>
                          updateInvite(index, "email", e.target.value)
                        }
                        placeholder="colleague@company.com"
                      />
                    </div>
                    <Select
                      value={invite.role}
                      onValueChange={(v) => updateInvite(index, "role", v)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Supervisor">Supervisor</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    {invites.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInvite(index)}
                      >
                        <Trash2 className="w-4 h-4 text-slate-400" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {invites.length < 10 && (
                <Button variant="outline" size="sm" onClick={addInvite}>
                  <Mail className="w-4 h-4 mr-2" /> Add another
                </Button>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <LoadingButton
                  className="flex-1"
                  loading={isLoading}
                  onClick={handleSubmit}
                >
                  Create Account
                </LoadingButton>
              </div>
              <button
                onClick={handleSubmit}
                className="w-full text-sm text-slate-500 hover:text-slate-700 text-center"
                disabled={isLoading}
              >
                Skip invitations for now
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
