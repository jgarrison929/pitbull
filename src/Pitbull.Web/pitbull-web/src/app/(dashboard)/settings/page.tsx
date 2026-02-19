"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  User,
  Shield,
  Building2,
  Key,
  Calendar,
  Mail,
  Clock,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Palette,
  Bell,
  MapPin,
  Layout,
  FolderOpen,
  Save,
  CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";

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

// User preferences stored in localStorage
const PREFS_KEY = "pitbull-user-preferences";

interface UserPreferences {
  defaultProjectId: string;
  defaultProjectName: string;
  defaultView: "dashboard" | "time-entry";
  timeZone: string;
  notifyApprovals: boolean;
  notifyPayPeriod: boolean;
  notifyWeeklyDigest: boolean;
  notifyMentions: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  defaultProjectId: "",
  defaultProjectName: "",
  defaultView: "dashboard",
  timeZone: "America/Los_Angeles",
  notifyApprovals: true,
  notifyPayPeriod: true,
  notifyWeeklyDigest: false,
  notifyMentions: true,
};

function loadPrefs(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return DEFAULT_PREFS;
}

const TIME_ZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

interface ProjectOption {
  id: string;
  name: string;
  number: string;
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(loadPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [profileData, projectsData] = await Promise.all([
        api<UserProfile>("/api/auth/me"),
        api<{ items: ProjectOption[] }>("/api/projects?pageSize=100").catch(
          () => ({ items: [] as ProjectOption[] })
        ),
      ]);
      setProfile(profileData);
      setProjects(projectsData.items || []);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updatePref = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setPrefsSaved(false);
  };

  const savePrefs = () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setPrefsSaved(true);
    toast.success("Preferences saved");
    setTimeout(() => setPrefsSaved(false), 3000);
  };

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
          Manage your account, preferences, and notifications
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
            <CardDescription>Your personal account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">
                  First Name
                </Label>
                <p className="font-medium">{profile?.firstName}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">
                  Last Name
                </Label>
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
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                        : role === "Manager"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
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
                <p className="text-sm">
                  {formatDate(profile?.lastLoginAt ?? null)}
                </p>
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
            <CardDescription>Your company information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase">
                Company Name
              </Label>
              <p className="font-medium">{profile?.tenantName}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase">
                Company ID
              </Label>
              <p className="font-mono text-sm text-muted-foreground">
                {profile?.tenantId}
              </p>
            </div>

            {isAdmin && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  As an administrator, you can manage users and settings for your
                  organization.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" asChild className="flex-1">
                    <Link href="/admin/users">Manage Users</Link>
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <Link href="/admin/company">Company Settings</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how Pitbull looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="theme"
                className="text-muted-foreground text-xs uppercase"
              >
                Theme
              </Label>
              <Select
                value={theme}
                onValueChange={(value: "light" | "dark" | "system") =>
                  setTheme(value)
                }
              >
                <SelectTrigger id="theme" className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      <span>Light</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <span>Dark</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select your preferred color scheme. System will follow your device
                settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Default Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Default Preferences
            </CardTitle>
            <CardDescription>
              Customize your default experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                Default Project
              </Label>
              <Select
                value={prefs.defaultProjectId || "_none"}
                onValueChange={(v) => {
                  const proj = projects.find((p) => p.id === v);
                  updatePref("defaultProjectId", v === "_none" ? "" : v);
                  updatePref(
                    "defaultProjectName",
                    proj ? `${proj.number} – ${proj.name}` : ""
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (choose each time)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None (choose each time)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} – {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pre-selected when creating new time entries
              </p>
            </div>

            <div className="space-y-2">
              <Label>Default Start Page</Label>
              <Select
                value={prefs.defaultView}
                onValueChange={(v) =>
                  updatePref("defaultView", v as UserPreferences["defaultView"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="time-entry">Time Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Time Zone
              </Label>
              <Select
                value={prefs.timeZone}
                onValueChange={(v) => updatePref("timeZone", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_ZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Button
                onClick={savePrefs}
                size="sm"
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                <Save className="h-3.5 w-3.5" />
                Save Preferences
              </Button>
              {prefsSaved && (
                <span className="ml-3 text-sm text-green-600 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose which notifications you&apos;d like to receive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Time Entry Approvals</Label>
                  <p className="text-xs text-muted-foreground">
                    When your time entries are approved or rejected
                  </p>
                </div>
                <Switch
                  checked={prefs.notifyApprovals}
                  onCheckedChange={(checked) =>
                    updatePref("notifyApprovals", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Pay Period Reminders</Label>
                  <p className="text-xs text-muted-foreground">
                    Before pay periods lock
                  </p>
                </div>
                <Switch
                  checked={prefs.notifyPayPeriod}
                  onCheckedChange={(checked) =>
                    updatePref("notifyPayPeriod", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Weekly Digest</Label>
                  <p className="text-xs text-muted-foreground">
                    Weekly summary of project activity
                  </p>
                </div>
                <Switch
                  checked={prefs.notifyWeeklyDigest}
                  onCheckedChange={(checked) =>
                    updatePref("notifyWeeklyDigest", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Mentions &amp; Assignments</Label>
                  <p className="text-xs text-muted-foreground">
                    When you&apos;re mentioned or assigned to an RFI
                  </p>
                </div>
                <Switch
                  checked={prefs.notifyMentions}
                  onCheckedChange={(checked) =>
                    updatePref("notifyMentions", checked)
                  }
                />
              </div>
            </div>

            <div className="mt-4">
              <Button
                onClick={savePrefs}
                size="sm"
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                <Save className="h-3.5 w-3.5" />
                Save Preferences
              </Button>
              {prefsSaved && (
                <span className="ml-3 text-sm text-green-600 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
            </div>
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
            <form
              onSubmit={handlePasswordChange}
              className="space-y-4 max-w-md"
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
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
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
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
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <LoadingButton
                type="submit"
                loading={isChangingPassword}
                loadingText="Changing..."
                className="bg-amber-500 hover:bg-amber-600"
              >
                Change Password
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Admin Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/overtime">Overtime Rules</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/time-tracking">Timecard Settings</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/pay-periods">Pay Periods</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/company">Company Settings</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/users">User Management</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/audit-logs">Audit Logs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
