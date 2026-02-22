"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { toast } from "sonner";

interface NotificationPreference {
  category: string;
  inApp: boolean;
  email: boolean;
}

interface DigestSetting {
  frequency: "None" | "Daily" | "Weekly";
  sendTime: string;
  dayOfWeek: number | null;
  lastSentAt: string | null;
}

interface CategoryMeta {
  key: string;
  label: string;
  group: "Time Tracking" | "Project Management" | "Deadlines" | "Documents" | "System";
}

const CATEGORY_META: CategoryMeta[] = [
  { key: "time_entry_submitted", label: "Time Entry Submitted", group: "Time Tracking" },
  { key: "time_entry_approved", label: "Time Entry Approved", group: "Time Tracking" },
  { key: "time_entry_rejected", label: "Time Entry Rejected", group: "Time Tracking" },
  { key: "pay_period_locked", label: "Pay Period Locked", group: "Time Tracking" },
  { key: "rfi_created", label: "RFI Created", group: "Project Management" },
  { key: "rfi_responded", label: "RFI Responded", group: "Project Management" },
  { key: "submittal_status_changed", label: "Submittal Status Changed", group: "Project Management" },
  { key: "daily_report_submitted", label: "Daily Report Submitted", group: "Project Management" },
  { key: "rfi_deadline_approaching", label: "RFI Deadline Approaching", group: "Deadlines" },
  { key: "overdue_rfi", label: "Overdue RFI", group: "Deadlines" },
  { key: "submittal_deadline_approaching", label: "Submittal Deadline Approaching", group: "Deadlines" },
  { key: "overdue_submittal", label: "Overdue Submittal", group: "Deadlines" },
  { key: "retention_deadline", label: "Retention Release Deadline", group: "Deadlines" },
  { key: "inspection_deadline", label: "Inspection Deadline", group: "Deadlines" },
  { key: "submittal_review_stale", label: "Submittal Review Stale (48h+)", group: "Deadlines" },
  { key: "document_uploaded", label: "Document Uploaded", group: "Documents" },
  { key: "system_announcement", label: "System Announcement", group: "System" },
];

const DEFAULT_PREFERENCES: NotificationPreference[] = CATEGORY_META.map((item) => ({
  category: item.key,
  inApp: true,
  email: false,
}));

const DEFAULT_DIGEST: DigestSetting = {
  frequency: "None",
  sendTime: "08:00",
  dayOfWeek: 1,
  lastSentAt: null,
};

const DAY_OPTIONS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(DEFAULT_PREFERENCES);
  const [digest, setDigest] = useState<DigestSetting>(DEFAULT_DIGEST);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const groupedCategories = useMemo(() => {
    return {
      "Time Tracking": CATEGORY_META.filter((c) => c.group === "Time Tracking"),
      "Project Management": CATEGORY_META.filter((c) => c.group === "Project Management"),
      Deadlines: CATEGORY_META.filter((c) => c.group === "Deadlines"),
      Documents: CATEGORY_META.filter((c) => c.group === "Documents"),
      System: CATEGORY_META.filter((c) => c.group === "System"),
    };
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prefs, digestSettings] = await Promise.all([
        api<NotificationPreference[]>("/api/notification-preferences"),
        api<DigestSetting>("/api/notification-preferences/digest"),
      ]);

      const prefMap = new Map(prefs.map((p) => [p.category, p]));
      const merged = CATEGORY_META.map((meta) => {
        const existing = prefMap.get(meta.key);
        return {
          category: meta.key,
          inApp: existing?.inApp ?? true,
          email: existing?.email ?? false,
        };
      });

      setPreferences(merged);
      setDigest({
        frequency: digestSettings.frequency,
        sendTime: digestSettings.sendTime,
        dayOfWeek: digestSettings.dayOfWeek,
        lastSentAt: digestSettings.lastSentAt,
      });
    } catch {
      toast.error("Failed to load notification settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updatePreference(category: string, field: "inApp" | "email", value: boolean) {
    setPreferences((prev) =>
      prev.map((item) =>
        item.category === category
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function handleResetDefaults() {
    setPreferences(DEFAULT_PREFERENCES);
    setDigest(DEFAULT_DIGEST);
    toast.success("Reset to default notification settings");
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await api<NotificationPreference[]>("/api/notification-preferences", {
        method: "PUT",
        body: {
          preferences: preferences.map((item) => ({
            category: item.category,
            inApp: item.inApp,
            email: item.email,
          })),
        },
      });

      await api<DigestSetting>("/api/notification-preferences/digest", {
        method: "PUT",
        body: {
          frequency: digest.frequency,
          sendTime: digest.sendTime,
          dayOfWeek: digest.frequency === "Weekly" ? digest.dayOfWeek : null,
        },
      });

      toast.success("Notification settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save notification settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Settings", href: "/settings" }, { label: "Notifications" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Choose how you receive in-app notifications and email updates by category.
        </p>
      </div>

      {Object.entries(groupedCategories).map(([group, categories]) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{group}</CardTitle>
            <CardDescription>{group} event notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notification</TableHead>
                  <TableHead className="text-right">In-App</TableHead>
                  <TableHead className="text-right">Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const pref = preferences.find((p) => p.category === category.key) ?? {
                    category: category.key,
                    inApp: true,
                    email: false,
                  };

                  return (
                    <TableRow key={category.key}>
                      <TableCell className="font-medium">{category.label}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Switch
                            checked={pref.inApp}
                            onCheckedChange={(checked) => updatePreference(category.key, "inApp", checked)}
                            disabled={isLoading}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Switch
                            checked={pref.email}
                            onCheckedChange={(checked) => updatePreference(category.key, "email", checked)}
                            disabled={isLoading}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Email Digest</CardTitle>
          <CardDescription>Configure summary digest delivery schedule.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={digest.frequency}
              onValueChange={(value) =>
                setDigest((prev) => ({
                  ...prev,
                  frequency: value as DigestSetting["frequency"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None">None</SelectItem>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-time">Send Time</Label>
            <Input
              id="send-time"
              type="time"
              value={digest.sendTime}
              onChange={(e) => setDigest((prev) => ({ ...prev, sendTime: e.target.value }))}
              disabled={digest.frequency === "None"}
            />
          </div>

          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select
              value={String(digest.dayOfWeek ?? 1)}
              onValueChange={(value) => setDigest((prev) => ({ ...prev, dayOfWeek: Number(value) }))}
              disabled={digest.frequency !== "Weekly"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleResetDefaults} disabled={isLoading || isSaving}>
          Reset to defaults
        </Button>
        <Button onClick={handleSave} disabled={isLoading || isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
