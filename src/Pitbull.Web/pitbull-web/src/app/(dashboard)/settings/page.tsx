"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Shield,
  Building2,
  Key,
  Calendar,
  Mail,
  Clock,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
  tenantId: string;
  tenantName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await api<UserProfile>("/api/auth/me");
        setProfile(data);
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });
      toast.success("Password changed successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your personal account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">First Name</Label>
                <p className="font-medium">{profile?.firstName}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Last Name</Label>
                <p className="font-medium">{profile?.lastName}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <p className="font-medium">{profile?.email}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Roles
              </Label>
              <div className="flex flex-wrap gap-2">
                {profile?.roles.map((role) => (
                  <span
                    key={role}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      role === "Admin"
                        ? "bg-red-100 text-red-800"
                        : role === "Manager"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Member Since
                </Label>
                <p className="text-sm">{formatDate(profile?.createdAt ?? null)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last Login
                </Label>
                <p className="text-sm">{formatDate(profile?.lastLoginAt ?? null)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization
            </CardTitle>
            <CardDescription>
              Your company information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase">Company Name</Label>
              <p className="font-medium">{profile?.tenantName}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase">Tenant ID</Label>
              <p className="font-mono text-sm text-muted-foreground">{profile?.tenantId}</p>
            </div>

            {isAdmin && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  As an administrator, you can manage users and settings for your organization.
                </p>
                <Button variant="outline" asChild className="w-full">
                  <a href="/admin/users">Manage Users</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isChangingPassword}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
