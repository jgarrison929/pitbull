"use client";

import { useCallback, useEffect, useState } from "react";
import api, { uploadFiles } from "@/lib/api";
import type { Project, PagedResult } from "@/lib/types";
import { ProjectStatus } from "@/lib/types";
import type { PmEntityDto, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropZone, type FileItem } from "@/components/ui/file-drop-zone";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CloudSun,
  FileText,
  MapPin,
  Send,
} from "lucide-react";

const STEPS = ["Project", "Weather", "Work", "Photos", "Review"] as const;
type Step = (typeof STEPS)[number];

interface PhotoWithLocation extends FileItem {
  latitude?: number;
  longitude?: number;
  caption?: string;
}

export default function MobileDailyReportPage() {
  const [step, setStep] = useState<Step>("Project");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  // Form state
  const [projectId, setProjectId] = useState("");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reportType, setReportType] = useState("Foreman");
  const [weatherSummary, setWeatherSummary] = useState("");
  const [temperatureLow, setTemperatureLow] = useState("");
  const [temperatureHigh, setTemperatureHigh] = useState("");
  const [precipitation, setPrecipitation] = useState("");
  const [wind, setWind] = useState("");
  const [workNarrative, setWorkNarrative] = useState("");
  const [delaysNarrative, setDelaysNarrative] = useState("");
  const [safetyNarrative, setSafetyNarrative] = useState("");
  const [photos, setPhotos] = useState<PhotoWithLocation[]>([]);
  const [geoAvailable, setGeoAvailable] = useState(false);

  useEffect(() => {
    setGeoAvailable("geolocation" in navigator);
  }, []);

  useEffect(() => {
    async function loadProjects() {
      try {
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=500"
        );
        setProjects(result.items ?? []);
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    void loadProjects();
  }, []);

  const stepIndex = STEPS.indexOf(step);

  const canProceed = useCallback(() => {
    switch (step) {
      case "Project":
        return !!projectId;
      case "Weather":
        return true;
      case "Work":
        return !!workNarrative.trim();
      case "Photos":
        return true;
      case "Review":
        return true;
      default:
        return false;
    }
  }, [step, projectId, workNarrative]);

  function goNext() {
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1]);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1]);
    }
  }

  // Attach GPS coordinates to photos when they're added
  function handlePhotosChange(newFiles: FileItem[]) {
    const existingIds = new Set(photos.map((p) => p.id));
    const added = newFiles.filter((f) => !existingIds.has(f.id));

    if (added.length > 0 && geoAvailable) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const withLocation: PhotoWithLocation[] = added.map((f) => ({
            ...f,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }));
          const kept = photos.filter((p) =>
            newFiles.some((nf) => nf.id === p.id)
          );
          setPhotos([...kept, ...withLocation]);
        },
        () => {
          // Geolocation failed — add without location
          const withoutLocation: PhotoWithLocation[] = added.map((f) => ({
            ...f,
          }));
          const kept = photos.filter((p) =>
            newFiles.some((nf) => nf.id === p.id)
          );
          setPhotos([...kept, ...withoutLocation]);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      // Removal or no geo — sync directly
      setPhotos(
        newFiles.map(
          (f) => photos.find((p) => p.id === f.id) ?? { ...f }
        )
      );
    }
  }

  async function submitReport(asDraft: boolean) {
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }

    const title = `Daily Report - ${reportDate}`;
    const payload: PmUpsertRequest = {
      title,
      status: asDraft ? "Draft" : "Submitted",
      data: {
        ReportDate: reportDate,
        ReportType: reportType,
        WeatherSummary: weatherSummary || null,
        TemperatureLow: temperatureLow ? Number(temperatureLow) : null,
        TemperatureHigh: temperatureHigh ? Number(temperatureHigh) : null,
        Precipitation: precipitation || null,
        Wind: wind || null,
        WorkNarrative: workNarrative || null,
        DelaysNarrative: delaysNarrative || null,
        SafetyNarrative: safetyNarrative || null,
      },
    };

    setSaving(true);
    try {
      const created = await api<PmEntityDto>(
        `/api/projects/${projectId}/daily-reports`,
        { method: "POST", body: payload }
      );

      // Upload photos
      const realFiles = photos
        .map((p) => p.file)
        .filter((f): f is File => f !== undefined);
      if (realFiles.length > 0) {
        try {
          const endpoint =
            realFiles.length === 1
              ? "/api/files/upload"
              : "/api/files/upload-multiple";
          await uploadFiles(endpoint, realFiles, {
            relatedEntityType: "DailyReport",
            relatedEntityId: created.id,
          });
        } catch {
          toast.error("Report saved but photo upload failed");
        }
      }

      toast.success(
        asDraft ? "Draft saved" : "Report submitted",
        {
          description: `${title} — ${photos.length} photo(s)`,
        }
      );

      // Reset form
      setStep("Project");
      setReportDate(new Date().toISOString().slice(0, 10));
      setWeatherSummary("");
      setTemperatureLow("");
      setTemperatureHigh("");
      setPrecipitation("");
      setWind("");
      setWorkNarrative("");
      setDelaysNarrative("");
      setSafetyNarrative("");
      setPhotos([]);
    } catch (error) {
      toast.error("Failed to save report", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <ErrorBoundary label="mobile daily report">
      <div className="min-h-screen pb-32">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Daily Report</h1>
            <Badge variant="outline" className="text-xs">
              {stepIndex + 1} / {STEPS.length}
            </Badge>
          </div>
          {/* Step indicators */}
          <div className="flex gap-1 mt-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-amber-500" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-4 space-y-4">
          {step === "Project" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Select Project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger className="min-h-[48px] text-base">
                      <SelectValue placeholder="Choose a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects
                        .filter((p) => p.status === ProjectStatus.Active || p.status === ProjectStatus.PreConstruction)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id} className="py-3">
                            <span className="font-mono text-sm">{p.number}</span>{" "}
                            <span>{p.name}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="min-h-[48px] text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger className="min-h-[48px] text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Foreman" className="py-3">
                          Foreman
                        </SelectItem>
                        <SelectItem value="ProjectManager" className="py-3">
                          Project Manager
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "Weather" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CloudSun className="h-5 w-5 text-amber-500" />
                  Weather & Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Summary</Label>
                  <Input
                    value={weatherSummary}
                    onChange={(e) => setWeatherSummary(e.target.value)}
                    placeholder="e.g. Clear and sunny"
                    className="min-h-[48px] text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Low Temp</Label>
                    <Input
                      type="number"
                      value={temperatureLow}
                      onChange={(e) => setTemperatureLow(e.target.value)}
                      placeholder="°F"
                      className="min-h-[48px] text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>High Temp</Label>
                    <Input
                      type="number"
                      value={temperatureHigh}
                      onChange={(e) => setTemperatureHigh(e.target.value)}
                      placeholder="°F"
                      className="min-h-[48px] text-base"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Precipitation</Label>
                    <Input
                      value={precipitation}
                      onChange={(e) => setPrecipitation(e.target.value)}
                      placeholder="None, Light rain..."
                      className="min-h-[48px] text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wind</Label>
                    <Input
                      value={wind}
                      onChange={(e) => setWind(e.target.value)}
                      placeholder="Calm, 10 mph NW..."
                      className="min-h-[48px] text-base"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "Work" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Work & Safety
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    Work Narrative <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={workNarrative}
                    onChange={(e) => setWorkNarrative(e.target.value)}
                    placeholder="Describe work performed today..."
                    rows={4}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delays</Label>
                  <Textarea
                    value={delaysNarrative}
                    onChange={(e) => setDelaysNarrative(e.target.value)}
                    placeholder="Any delays encountered..."
                    rows={3}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Safety</Label>
                  <Textarea
                    value={safetyNarrative}
                    onChange={(e) => setSafetyNarrative(e.target.value)}
                    placeholder="Safety observations, toolbox talks..."
                    rows={3}
                    className="text-base"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === "Photos" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-amber-500" />
                  Progress Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {geoAvailable && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    GPS location will be attached to photos
                  </div>
                )}
                <FileDropZone
                  files={photos}
                  onFilesChange={handlePhotosChange}
                  accept=".jpg,.jpeg,.png,.heic,.webp"
                  maxFiles={20}
                  maxSizeMB={25}
                  enableCamera
                  placeholder="Take or upload progress photos"
                />
              </CardContent>
            </Card>
          )}

          {step === "Review" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-amber-500" />
                    Review & Submit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Project</p>
                      <p className="font-medium">
                        {selectedProject?.name ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">{reportDate}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">
                        {reportType === "ProjectManager"
                          ? "Project Manager"
                          : "Foreman"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Photos</p>
                      <p className="font-medium">{photos.length}</p>
                    </div>
                  </div>

                  {weatherSummary && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Weather</p>
                      <p>
                        {weatherSummary}
                        {(temperatureLow || temperatureHigh) &&
                          ` — ${temperatureLow || "?"}°F to ${temperatureHigh || "?"}°F`}
                      </p>
                    </div>
                  )}

                  {workNarrative && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Work Performed</p>
                      <p className="whitespace-pre-wrap">{workNarrative}</p>
                    </div>
                  )}

                  {delaysNarrative && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Delays</p>
                      <p className="whitespace-pre-wrap">{delaysNarrative}</p>
                    </div>
                  )}

                  {safetyNarrative && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Safety</p>
                      <p className="whitespace-pre-wrap">{safetyNarrative}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-square rounded-lg overflow-hidden border"
                    >
                      {photo.preview ? (
                        <img
                          src={photo.preview}
                          alt={photo.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-muted">
                          <Camera className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      {photo.latitude && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                          <MapPin className="h-2.5 w-2.5 text-white inline" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 bg-background border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-20">
          <div className="flex gap-3">
            {stepIndex > 0 && (
              <Button
                variant="outline"
                onClick={goBack}
                className="min-h-[48px]"
                disabled={saving}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            {step === "Review" ? (
              <div className="flex-1 flex gap-2">
                <LoadingButton
                  variant="outline"
                  onClick={() => submitReport(true)}
                  loading={saving}
                  loadingText="Saving..."
                  className="flex-1 min-h-[48px]"
                >
                  Save Draft
                </LoadingButton>
                <LoadingButton
                  onClick={() => submitReport(false)}
                  loading={saving}
                  loadingText="Submitting..."
                  className="flex-1 min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Submit
                </LoadingButton>
              </div>
            ) : (
              <Button
                onClick={goNext}
                disabled={!canProceed()}
                className="flex-1 min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
