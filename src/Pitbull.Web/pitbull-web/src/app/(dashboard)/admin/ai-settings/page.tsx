"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AiKeyInfo {
  provider: string;
  fingerprint: string;
  createdAt: string;
}

interface AiSettings {
  keys: AiKeyInfo[];
}

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
];

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<AiSettings>("/api/ai/settings");
      setSettings(result);
    } catch {
      toast.error("Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function storeKey() {
    if (!apiKey.trim()) {
      toast.error("API key is required");
      return;
    }
    setSaving(true);
    try {
      await api("/api/ai/settings/keys", {
        method: "POST",
        body: { provider, apiKey: apiKey.trim() },
      });
      toast.success(`${provider} API key saved`);
      setApiKey("");
      await load();
    } catch (error) {
      toast.error("Failed to save API key", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(providerName: string) {
    setSaving(true);
    try {
      await api(`/api/ai/settings/keys/${providerName}`, { method: "DELETE" });
      toast.success(`${providerName} API key revoked`);
      await load();
    } catch (error) {
      toast.error("Failed to revoke API key", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Settings</h1>
        <p className="text-muted-foreground">
          Configure AI providers for document intelligence features.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Providers</CardTitle>
          <CardDescription>
            API keys are encrypted at rest. Only the key fingerprint is displayed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : settings?.keys && settings.keys.length > 0 ? (
            <div className="space-y-3">
              {settings.keys.map((key) => (
                <div
                  key={key.provider}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium capitalize">{key.provider}</p>
                    <p className="text-sm text-muted-foreground">
                      Key: ...{key.fingerprint} &middot; Added{" "}
                      {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeKey(key.provider)}
                    disabled={saving}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No AI providers configured. Add an API key below to enable AI features.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Provider</CardTitle>
          <CardDescription>
            Store an API key for an AI provider. Keys are encrypted before storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
          </div>
          <Button onClick={storeKey} disabled={saving || !apiKey.trim()}>
            {saving ? "Saving..." : "Save Key"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Features</CardTitle>
          <CardDescription>
            Available AI-powered features across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">AI Chat Assistant</p>
              <p className="text-muted-foreground">
                In-app chat assistant for construction questions — budgets, schedules, RFI drafting,
                and industry best practices. Available via the floating button on every page.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Smart Field Suggestions</p>
              <p className="text-muted-foreground">
                AI-powered suggestions for text fields on forms. Click the sparkle icon on any
                smart field to get contextual suggestions for descriptions, scope of work, and more.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Document Analysis</p>
              <p className="text-muted-foreground">
                Extract structured data from uploaded documents — dates, amounts, parties, key terms,
                and actionable recommendations for subcontracts, change orders, and insurance certificates.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Daily Report Summary</p>
              <p className="text-muted-foreground">
                Generate executive summaries from daily field reports including weather, crew, and
                safety information.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Submittal Review</p>
              <p className="text-muted-foreground">
                AI-assisted compliance review of submittals with spec section analysis and
                actionable recommendations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
