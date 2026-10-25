"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Check, X, Building2, UserPlus } from "lucide-react";
import api from "@/lib/api";
import { setToken } from "@/lib/auth";

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  companyName: string;
  tenantName: string;
  invitedBy: string;
  expiresAt: string;
  canAccept: boolean;
  isExpired: boolean;
  status: string;
}

interface AcceptResponse {
  token: string;
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const data = await api<InvitationInfo>(
          `/api/invitation/token/${token}`
        );
        setInvitation(data);
      } catch {
        setError("Invitation not found or has expired.");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchInvitation();
  }, [token]);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    Object.values(passwordChecks).every(Boolean) &&
    password === confirmPassword;

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    try {
      const response = await api<AcceptResponse>(
        `/api/invitation/token/${token}/accept`,
        {
          method: "POST",
          body: { firstName, lastName, password },
        }
      );

      setToken(response.token);
      toast.success(`Welcome to ${invitation?.companyName || "your team"}!`);
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to accept invitation";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading invitation...</div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Invalid Invitation
          </h2>
          <p className="text-slate-500 mb-6">
            {error || "This invitation link is invalid or has expired."}
          </p>
          <Link
            href="/demo"
            className="text-blue-600 hover:underline text-sm"
          >
            Try the demo instead
          </Link>
        </div>
      </div>
    );
  }

  if (!invitation.canAccept) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Invitation {invitation.isExpired ? "Expired" : invitation.status}
          </h2>
          <p className="text-slate-500 mb-6">
            This invitation can no longer be accepted. Please ask{" "}
            {invitation.invitedBy} to send a new one.
          </p>
          <Link
            href="/login"
            className="text-blue-600 hover:underline text-sm"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Pitbull</h1>
          <p className="text-slate-500 mt-1">Construction Solutions</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Invitation Info */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 mb-6">
            <Building2 className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {invitation.invitedBy} invited you to join
              </p>
              <p className="text-lg font-semibold text-blue-900">
                {invitation.companyName}
              </p>
              <p className="text-xs text-blue-600">
                Role: {invitation.role}
              </p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            <UserPlus className="w-5 h-5 inline mr-2" />
            Create your account
          </h2>

          <form onSubmit={handleAccept} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input value={invitation.email} disabled className="bg-slate-50" />
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
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">
                  Passwords don&apos;t match
                </p>
              )}
            </div>

            <LoadingButton
              type="submit"
              className="w-full"
              loading={submitting}
              disabled={!isValid}
            >
              Join {invitation.companyName}
            </LoadingButton>
          </form>
        </div>

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
