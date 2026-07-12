"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import api, { uploadFiles } from "@/lib/api";
import type { Project, PagedResult } from "@/lib/types";
import type { PmEntityDto, PmUpsertRequest } from "@/lib/pm-types";
import {
  isFieldReportEligibleStatus,
  resolveDefaultFieldReportProjectId,
  toProjectLookupItems,
} from "@/lib/projects";
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
import { EntityLookupField } from "@/components/ui/entity-lookup-field";
import { FileDropZone, type FileItem } from "@/components/ui/file-drop-zone";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { OfflineIndicator } from "@/components/time-tracking/offline-indicator";
import { useRecentSelections } from "@/hooks/use-recent-selections";
import { useRecentProjects } from "@/hooks/use-recent-projects";
import { useOnlineStatus } from "@/lib/use-online-status";
import { getValidRecentIds } from "@/lib/entity-lookup";
import {
  buildDailyReportApiData,
  buildOfflineDailyReportPayload,
} from "@/lib/daily-report-offline";
import { enqueueDailyReportForSync } from "@/lib/offline-store";
import { requestBackgroundSync } from "@/components/service-worker-register";
import { captureProductEvent } from "@/lib/posthog";
import {
  FIELD_REPORT_STEP_EVENT,
  FIELD_REPORT_SUBMITTED_EVENT,
  buildFieldReportStepProps,
  buildFieldReportSubmittedProps,
} from "@/lib/field-report-analytics";
import { applyVoiceTranscriptToNarratives } from "@/lib/voice-transcript";
import { buildPlansSpecsHref } from "@/lib/plans-specs-lookup";
import { buildProgressDraftHref } from "@/lib/progress-deep-link";
import { buildSiteWalkHref } from "@/lib/site-walk";
import { buildOfflinePhotos, countEmbeddedPhotos } from "@/lib/offline-photo";
import {
  formatZoneLabel,
  normalizeZoneOptions,
  pickSpatialContext,
  pickPlanSheet,
  type SpatialZoneOption,
  type PlanSheetOption,
} from "@/lib/spatial-context";
import {
  DEFAULT_CREW_TRADES,
  FIELD_ACTIVITIES,
  TRUCK_CONDITIONS,
  MOBILE_REPORT_STEPS,
  type FieldActivityId,
  type FieldCrewCount,
  type MobileReportStep,
  type TruckConditionId,
  isFieldStepReady,
  nextReportStep,
  prevReportStep,
  showsTruckMaterialSection,
  toggleFieldActivity,
  toggleTruckCondition,
} from "@/lib/pour-field";
import { MOBILE_FIELD_WIZARD_ACTION_BAR } from "@/components/layout/mobile-shell";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CloudSun,
  FileText,
  HardHat,
  MapPin,
  Mic,
  MicOff,
  Send,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoWithLocation extends FileItem {
  latitude?: number;
  longitude?: number;
  caption?: string;
}

export default function MobileDailyReportPage() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId");
  const urlZoneId = searchParams.get("zoneId");
  const urlActivityId = searchParams.get("activityId");
  const urlActivityName = searchParams.get("activityName");
  const [step, setStep] = useState<MobileReportStep>("Project");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const { recentItems: recentProjects, addRecent: addRecentProject } =
    useRecentSelections("project");
  const { recentProjects: recentViewedProjects } = useRecentProjects();
  const { isOnline, pendingCount, refreshPendingCount } = useOnlineStatus();
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const defaultProjectAppliedRef = useRef(false);
  const recognitionRef = useRef<{
    stop: () => void;
    start: () => void;
  } | null>(null);

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
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showWeather, setShowWeather] = useState(false);

  // Field / pour capture
  const [activities, setActivities] = useState<FieldActivityId[]>([]);
  const [truckConditions, setTruckConditions] = useState<TruckConditionId[]>(
    []
  );
  const [truckNotes, setTruckNotes] = useState("");
  const [crewCounts, setCrewCounts] = useState<FieldCrewCount[]>(() =>
    DEFAULT_CREW_TRADES.map((trade) => ({ trade, count: 0 }))
  );
  // Optional zones-first twin fuel — never required for submit/offline
  const [zones, setZones] = useState<SpatialZoneOption[]>([]);
  const [spatialNodeId, setSpatialNodeId] = useState("");
  const [planSheets, setPlanSheets] = useState<PlanSheetOption[]>([]);
  const [planSheetId, setPlanSheetId] = useState("");

  useEffect(() => {
    setGeoAvailable("geolocation" in navigator);
    const SR =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              SpeechRecognition?: new () => unknown;
              webkitSpeechRecognition?: new () => unknown;
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              webkitSpeechRecognition?: new () => unknown;
            }
          ).webkitSpeechRecognition
        : undefined;
    setVoiceSupported(!!SR);
  }, []);

  useEffect(() => {
    async function loadProjects() {
      try {
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=500&view=mobile"
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

  // Load zone options when job changes (skip-safe if graph missing / offline)
  useEffect(() => {
    if (!projectId) {
      setZones([]);
      setSpatialNodeId("");
      return;
    }
    let cancelled = false;
    async function loadZones() {
      if (!isOnline) {
        setZones([]);
        return;
      }
      try {
        const raw = await api<unknown>(
          `/api/projects/${projectId}/spatial/zones`
        );
        if (cancelled) return;
        const options = normalizeZoneOptions(raw);
        setZones(options);
        // Deep-link from twin "field report in this zone"
        if (urlZoneId && options.some((z) => z.id === urlZoneId)) {
          setSpatialNodeId(urlZoneId);
        }
      } catch {
        if (!cancelled) setZones([]);
      }
    }
    void loadZones();
    return () => {
      cancelled = true;
    };
  }, [projectId, isOnline, urlZoneId]);
  // Optional plan sheet catalog for twin fuel (2.14.0)
  useEffect(() => {
    if (!projectId) {
      setPlanSheets([]);
      setPlanSheetId("");
      return;
    }
    let cancelled = false;
    async function loadPlanSheets() {
      if (!isOnline) {
        setPlanSheets([]);
        return;
      }
      try {
        const raw = await api<{ items?: Array<Record<string, unknown>> }>(
          `/api/projects/${projectId}/plan-sets?page=1&pageSize=200`
        );
        if (cancelled) return;
        const items = raw.items ?? [];
        const options: PlanSheetOption[] = items.map((row) => {
          const id = String(row.id ?? row.Id ?? "");
          const name = String(row.name ?? row.Name ?? "");
          const data = (row.data ?? row.Data ?? {}) as Record<string, unknown>;
          const sheetNo = String(
            data.SheetNumber ?? data.sheetNumber ?? name
          );
          return {
            id,
            drawingNumber: sheetNo || name || id.slice(0, 8),
            title: name || sheetNo,
          };
        }).filter((o) => o.id);
        setPlanSheets(options);
      } catch {
        if (!cancelled) setPlanSheets([]);
      }
    }
    void loadPlanSheets();
    return () => {
      cancelled = true;
    };
  }, [projectId, isOnline]);

  // Default project from URL (in-job links) or recent job context once catalog loads.
  useEffect(() => {
    if (defaultProjectAppliedRef.current || loading || projectId) return;
    const eligibleIds = projects
      .filter((p) => isFieldReportEligibleStatus(p.status))
      .map((p) => p.id);
    if (eligibleIds.length === 0) return;

    const resolved = resolveDefaultFieldReportProjectId(eligibleIds, [
      urlProjectId,
      ...recentViewedProjects.map((p) => p.id),
      ...recentProjects.map((p) => p.id),
    ]);
    if (!resolved) return;

    defaultProjectAppliedRef.current = true;
    setProjectId(resolved);
    const match = projects.find((p) => p.id === resolved);
    if (match) {
      addRecentProject(resolved, `${match.number} - ${match.name}`);
    }
    // Explicit project deep-link: skip past pick list — super already on that job.
    if (urlProjectId && resolved === urlProjectId.trim()) {
      setStep("Field");
    }
  }, [
    loading,
    projectId,
    projects,
    urlProjectId,
    recentViewedProjects,
    recentProjects,
    addRecentProject,
  ]);

  const applyVoiceToForm = useCallback(
    (transcript: string) => {
      const next = applyVoiceTranscriptToNarratives(
        { workNarrative, delaysNarrative, safetyNarrative },
        transcript
      );
      setWorkNarrative(next.workNarrative);
      setDelaysNarrative(next.delaysNarrative);
      setSafetyNarrative(next.safetyNarrative);
    },
    [workNarrative, delaysNarrative, safetyNarrative]
  );

  function toggleVoice() {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const Win = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((ev: {
          results: {
            [i: number]: { [j: number]: { transcript: string } };
            length: number;
          };
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((ev: {
          results: {
            [i: number]: { [j: number]: { transcript: string } };
            length: number;
          };
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
    };
    const SR = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row?.[0]?.transcript) text += row[0].transcript;
      }
      if (text.trim()) {
        applyVoiceToForm(text);
        toast.success("Voice added");
      }
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Voice capture failed — type instead");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      toast.error("Could not start microphone");
      setListening(false);
    }
  }

  const stepIndex = MOBILE_REPORT_STEPS.indexOf(step);

  const showTrucksMaterial = showsTruckMaterialSection(activities);

  const fieldSnapshot = useMemo(
    () => ({
      activities,
      // Drop truck fuel from readiness/summary when Pour is not selected
      truckConditions: showTrucksMaterial ? truckConditions : [],
      truckNotes: showTrucksMaterial ? truckNotes : "",
      crewCounts,
      workNarrative,
    }),
    [
      activities,
      showTrucksMaterial,
      truckConditions,
      truckNotes,
      crewCounts,
      workNarrative,
    ]
  );

  const canProceed = useCallback(() => {
    switch (step) {
      case "Project":
        return !!projectId;
      case "Field":
        return isFieldStepReady(fieldSnapshot);
      case "Photos":
        return true;
      case "Review":
        return !!projectId && isFieldStepReady(fieldSnapshot);
      default:
        return false;
    }
  }, [step, projectId, fieldSnapshot]);

  function goNext() {
    const n = nextReportStep(step);
    if (n) {
      captureProductEvent(
        FIELD_REPORT_STEP_EVENT,
        buildFieldReportStepProps({
          from_step: step,
          to_step: n,
          direction: "next",
          project_id: projectId,
        })
      );
      setStep(n);
    }
  }

  function goBack() {
    const p = prevReportStep(step);
    if (p) {
      captureProductEvent(
        FIELD_REPORT_STEP_EVENT,
        buildFieldReportStepProps({
          from_step: step,
          to_step: p,
          direction: "back",
          project_id: projectId,
        })
      );
      setStep(p);
    }
  }

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
      setPhotos(
        newFiles.map((f) => photos.find((p) => p.id === f.id) ?? { ...f })
      );
    }
  }

  function formSnapshot(asDraft: boolean) {
    const spatialDecision = pickSpatialContext(zones, spatialNodeId);
    const trucksOn = showsTruckMaterialSection(activities);
    return {
      projectId,
      reportDate,
      reportType,
      weatherSummary,
      temperatureLow,
      temperatureHigh,
      precipitation,
      wind,
      workNarrative,
      delaysNarrative,
      safetyNarrative,
      fieldActivities: activities,
      truckConditions: trucksOn ? truckConditions : [],
      truckNotes: trucksOn ? truckNotes : "",
      crewCounts,
      zones,
      spatialNodeId:
        spatialDecision.kind === "apply"
          ? spatialDecision.spatialNodeId
          : undefined,
      planSheets,
      planSheetId:
        pickPlanSheet(planSheets, planSheetId).kind === "apply"
          ? planSheetId
          : undefined,
      asDraft,
    };
  }

  function resetForm() {
    setStep("Project");
    setReportDate(new Date().toISOString().slice(0, 10));
    setWeatherSummary("");
    setTemperatureLow("");
    setTemperatureHigh("");
    setPrecipitation("");
    setWind("");
    setWorkNarrative("");
    setDelaysNarrative("");
    setPlanSheetId("");
    setSafetyNarrative("");
    setPhotos([]);
    setActivities([]);
    setTruckConditions([]);
    setTruckNotes("");
    setCrewCounts(DEFAULT_CREW_TRADES.map((trade) => ({ trade, count: 0 })));
    setSpatialNodeId("");
    setQueuedNotice(null);
  }

  async function queueOffline(asDraft: boolean) {
    const offlinePhotos = await buildOfflinePhotos(photos);
    const embedded = countEmbeddedPhotos(offlinePhotos);
    const skipped = offlinePhotos.filter((p) => p.skippedForSize).length;

    const offlinePayload = buildOfflineDailyReportPayload({
      ...formSnapshot(asDraft),
      photos: offlinePhotos,
    });
    await enqueueDailyReportForSync(offlinePayload);
    requestBackgroundSync();
    await refreshPendingCount();

    let photoNote = "";
    if (embedded > 0) photoNote = ` · ${embedded} photo(s) embedded`;
    if (skipped > 0)
      photoNote += ` · ${skipped} too large (retake smaller or upload online)`;

    setQueuedNotice(
      `${offlinePayload.title} queued offline${photoNote} — syncs when connected`
    );
    toast.success(asDraft ? "Draft queued offline" : "Report queued offline", {
      description:
        embedded > 0
          ? "Report + photos saved on device"
          : "Report saved; large photos need online upload",
    });
    captureProductEvent(
      FIELD_REPORT_SUBMITTED_EVENT,
      buildFieldReportSubmittedProps({
        project_id: projectId,
        as_draft: asDraft,
        photo_count: embedded,
        offline: true,
      })
    );
    resetForm();
  }

  async function submitReport(asDraft: boolean) {
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }
    if (!isFieldStepReady(fieldSnapshot)) {
      toast.error("Add work activity, crew, truck note, or narrative first");
      return;
    }

    const title = `Daily Report - ${reportDate}`;
    // Server assigns Draft on create — do not send Submitted (INVALID_STATUS_TRANSITION).
    const payload: PmUpsertRequest = {
      title,
      data: buildDailyReportApiData(formSnapshot(asDraft)),
    };

    setSaving(true);
    try {
      if (!isOnline) {
        await queueOffline(asDraft);
        return;
      }

      const created = await api<PmEntityDto>(
        `/api/projects/${projectId}/daily-reports`,
        { method: "POST", body: payload }
      );

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

      // Field "Submit" = create draft then workflow submit action
      if (!asDraft && created.id) {
        await api(
          `/api/projects/${projectId}/daily-reports/${created.id}/submit`,
          { method: "POST" }
        );
      }

      toast.success(asDraft ? "Draft saved" : "Report submitted", {
        description: `${title} — ${photos.length} photo(s)`,
      });
      captureProductEvent(
        FIELD_REPORT_SUBMITTED_EVENT,
        buildFieldReportSubmittedProps({
          project_id: projectId,
          as_draft: asDraft,
          photo_count: photos.length,
          offline: false,
        })
      );
      resetForm();
    } catch (error) {
      try {
        await queueOffline(asDraft);
      } catch {
        toast.error("Failed to save report", {
          description:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  // API serializes ProjectStatus as strings ("Active"); never compare to numeric enum raw.
  const activeProjects = useMemo(
    () => projects.filter((p) => isFieldReportEligibleStatus(p.status)),
    [projects]
  );

  const projectLookupItems = useMemo(
    () => toProjectLookupItems(projects, { eligibleOnly: true }),
    [projects]
  );

  const recentProjectIds = useMemo(
    () => getValidRecentIds(recentProjects, activeProjects.map((p) => p.id)),
    [recentProjects, activeProjects]
  );

  function handleProjectSelect(id: string) {
    setProjectId(id);
    const match = activeProjects.find((p) => p.id === id);
    if (match) {
      addRecentProject(id, `${match.number} - ${match.name}`);
    }
  }

  function setCrewCount(trade: string, count: number) {
    setCrewCounts((prev) =>
      prev.map((r) =>
        r.trade === trade ? { ...r, count: Math.max(0, count) } : r
      )
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <ErrorBoundary label="mobile daily report">
      <div className="min-h-screen pb-32">
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Field report</h1>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <Badge variant="secondary" className="text-xs">
                  Offline
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge className="text-xs bg-amber-500 text-white">
                  {pendingCount} queued
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {stepIndex + 1} / {MOBILE_REPORT_STEPS.length}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1 mt-2">
            {MOBILE_REPORT_STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-amber-500" : "bg-muted"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {step === "Project" && "Which job?"}
            {step === "Field" && "What happened on site today?"}
            {step === "Photos" && "Optional photos"}
            {step === "Review" && "Check and send"}
          </p>
        </div>

        <div className="p-4 space-y-4">
          <OfflineIndicator />
          {queuedNotice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
              {queuedNotice}
            </div>
          )}

          {step === "Project" && urlActivityName && (
            <p
              className="text-sm rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2"
              data-testid="field-report-schedule-activity"
            >
              Linked schedule activity: <strong>{urlActivityName}</strong>
              {projectId && (
                <>
                  {" · "}
                  <Link
                    className="text-amber-800 underline"
                    href={buildProgressDraftHref(projectId, {
                      activityId: urlActivityId ?? undefined,
                      activityName: urlActivityName,
                    })}
                  >
                    Open progress
                  </Link>
                </>
              )}
            </p>
          )}
          {step === "Project" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Job
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EntityLookupField
                  label="Project"
                  required
                  value={projectId}
                  onSelect={handleProjectSelect}
                  items={projectLookupItems}
                  recentIds={recentProjectIds}
                  placeholder="Search job number or name..."
                  allowClear={false}
                  emptyCatalogMessage="No open jobs available. Check Projects or your company."
                  helpText={
                    projectId
                      ? "Pre-filled from the job you were on — change if needed."
                      : undefined
                  }
                />
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
                        <SelectItem value="Foreman">Foreman</SelectItem>
                        <SelectItem value="ProjectManager">
                          Project Manager
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {projectId && zones.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-500" />
                      Zone (optional)
                    </Label>
                    <Select
                      value={spatialNodeId || "__none__"}
                      onValueChange={(v) =>
                        setSpatialNodeId(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger
                        className="min-h-[48px] text-base"
                        data-testid="field-zone-select"
                      >
                        <SelectValue placeholder="No zone (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {formatZoneLabel(null)}
                        </SelectItem>
                        {zones.map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {formatZoneLabel(z)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Optional twin fuel — skip anytime, including offline.
                    </p>
                  </div>
                )}

                {projectId && planSheets.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-amber-500" />
                      Plan sheet (optional)
                    </Label>
                    <Select
                      value={planSheetId || "__none__"}
                      onValueChange={(v) =>
                        setPlanSheetId(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger
                        className="min-h-[48px] text-base"
                        data-testid="field-plan-sheet-select"
                      >
                        <SelectValue placeholder="No plan sheet (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No plan sheet</SelectItem>
                        {planSheets.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.drawingNumber}
                            {s.title && s.title !== s.drawingNumber
                              ? ` — ${s.title}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Optional — included on submit / offline queue as PlanSheetId.
                    </p>
                  </div>
                )}
                {projectId && (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="min-h-[48px]" asChild>
                      <Link href={buildSiteWalkHref(projectId)}>
                        Today on this job
                      </Link>
                    </Button>
                    <Button variant="ghost" className="min-h-[44px]" asChild>
                      <Link
                        href={buildPlansSpecsHref(projectId, { view: "plans" })}
                      >
                        Open plans
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === "Field" && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HardHat className="h-5 w-5 text-amber-500" />
                    What work?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {FIELD_ACTIVITIES.map((a) => {
                      const on = activities.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setActivities((prev) => {
                              const next = toggleFieldActivity(prev, a.id);
                              // Leaving Pour: clear concrete truck chips so they
                              // do not stick on review/offline payload.
                              if (!showsTruckMaterialSection(next)) {
                                setTruckConditions([]);
                                setTruckNotes("");
                              }
                              return next;
                            });
                          }}
                          className={cn(
                            "min-h-[56px] rounded-lg border px-2 py-2 text-center touch-manipulation",
                            on
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 font-semibold"
                              : "border-input bg-background"
                          )}
                          data-testid={`activity-${a.id}`}
                        >
                          <span className="block text-sm">{a.label}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {a.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {showTrucksMaterial && (
                <Card data-testid="trucks-material-section">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Truck className="h-4 w-4 text-amber-500" />
                      Trucks / material
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Concrete loads for today&apos;s pour — skip if not relevant.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TRUCK_CONDITIONS.map((t) => {
                        const on = truckConditions.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setTruckConditions((prev) =>
                                toggleTruckCondition(prev, t.id)
                              )
                            }
                            className={cn(
                              "min-h-[44px] rounded-full border px-4 text-sm touch-manipulation",
                              on
                                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 font-medium"
                                : "border-input"
                            )}
                            data-testid={`truck-${t.id}`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <Textarea
                      value={truckNotes}
                      onChange={(e) => setTruckNotes(e.target.value)}
                      placeholder="e.g. Load 3 too wet — drove around. Vault walls need better slump."
                      rows={2}
                      className="text-base min-h-[48px]"
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Crew counts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {crewCounts.map((row) => (
                    <div
                      key={row.trade}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm font-medium w-20">
                        {row.trade}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-11"
                          onClick={() =>
                            setCrewCount(row.trade, row.count - 1)
                          }
                        >
                          −
                        </Button>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={row.count || ""}
                          onChange={(e) =>
                            setCrewCount(
                              row.trade,
                              parseInt(e.target.value || "0", 10)
                            )
                          }
                          className="w-14 h-11 text-center text-lg font-bold"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-11"
                          onClick={() =>
                            setCrewCount(row.trade, row.count + 1)
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Notes / voice</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {voiceSupported && (
                    <Button
                      type="button"
                      variant={listening ? "default" : "outline"}
                      onClick={toggleVoice}
                      className="w-full min-h-[48px] gap-2"
                      data-testid="voice-input-button"
                    >
                      {listening ? (
                        <>
                          <MicOff className="h-4 w-4" /> Stop
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4" /> Voice note
                        </>
                      )}
                    </Button>
                  )}
                  <Textarea
                    value={workNarrative}
                    onChange={(e) => setWorkNarrative(e.target.value)}
                    placeholder="Anything else — location, pour sequence, issues…"
                    rows={3}
                    className="text-base"
                  />
                  <Textarea
                    value={delaysNarrative}
                    onChange={(e) => setDelaysNarrative(e.target.value)}
                    placeholder="Delays (optional)"
                    rows={2}
                    className="text-base"
                  />
                  <Textarea
                    value={safetyNarrative}
                    onChange={(e) => setSafetyNarrative(e.target.value)}
                    placeholder="Safety (optional)"
                    rows={2}
                    className="text-base"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setShowWeather((v) => !v)}
                  >
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CloudSun className="h-4 w-4 text-amber-500" />
                      Weather (optional)
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {showWeather ? "Hide" : "Show"}
                    </span>
                  </button>
                </CardHeader>
                {showWeather && (
                  <CardContent className="space-y-3">
                    <Input
                      value={weatherSummary}
                      onChange={(e) => setWeatherSummary(e.target.value)}
                      placeholder="Clear, rain, wind…"
                      className="min-h-[48px] text-base"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={temperatureLow}
                        onChange={(e) => setTemperatureLow(e.target.value)}
                        placeholder="Low °F"
                        className="min-h-[48px]"
                      />
                      <Input
                        type="number"
                        value={temperatureHigh}
                        onChange={(e) => setTemperatureHigh(e.target.value)}
                        placeholder="High °F"
                        className="min-h-[48px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={precipitation}
                        onChange={(e) => setPrecipitation(e.target.value)}
                        placeholder="Precip"
                        className="min-h-[48px]"
                      />
                      <Input
                        value={wind}
                        onChange={(e) => setWind(e.target.value)}
                        placeholder="Wind"
                        className="min-h-[48px]"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            </>
          )}

          {step === "Photos" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-amber-500" />
                  Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {geoAvailable && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> GPS attached when available
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Offline: up to 5 photos under ~1.2MB each are stored with the
                  report. Larger files need online upload.
                </p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-amber-500" />
                  Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Project</p>
                  <p className="font-medium">
                    {selectedProject
                      ? `${selectedProject.number} — ${selectedProject.name}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{reportDate}</p>
                </div>
                {activities.length > 0 && (
                  <div>
                    <p className="text-muted-foreground">Work</p>
                    <p className="font-medium">
                      {activities
                        .map(
                          (id) =>
                            FIELD_ACTIVITIES.find((a) => a.id === id)?.label
                        )
                        .join(", ")}
                    </p>
                  </div>
                )}
                {showTrucksMaterial &&
                  (truckConditions.length > 0 || truckNotes.trim()) && (
                  <div>
                    <p className="text-muted-foreground">Trucks / material</p>
                    <p className="font-medium">
                      {truckConditions
                        .map(
                          (id) =>
                            TRUCK_CONDITIONS.find((t) => t.id === id)?.label
                        )
                        .join(", ")}
                    </p>
                    {truckNotes && (
                      <p className="mt-1 whitespace-pre-wrap">{truckNotes}</p>
                    )}
                  </div>
                )}
                {crewCounts.some((c) => c.count > 0) && (
                  <div>
                    <p className="text-muted-foreground">Crew</p>
                    <p className="font-medium">
                      {crewCounts
                        .filter((c) => c.count > 0)
                        .map((c) => `${c.trade}×${c.count}`)
                        .join("; ")}
                    </p>
                  </div>
                )}
                {workNarrative && (
                  <div>
                    <p className="text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap">{workNarrative}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Photos</p>
                  <p className="font-medium">{photos.length}</p>
                </div>
                {!isOnline && (
                  <p className="text-amber-800 dark:text-amber-200 text-xs">
                    You are offline — submit will queue on this device.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom bar — nav hidden on this route; pin CTAs above home indicator only */}
        <div className={MOBILE_FIELD_WIZARD_ACTION_BAR}>
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
                  data-testid="field-report-draft"
                >
                  Draft
                </LoadingButton>
                <LoadingButton
                  onClick={() => submitReport(false)}
                  loading={saving}
                  loadingText="Sending..."
                  className="flex-1 min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white"
                  data-testid="field-report-submit"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Submit
                </LoadingButton>
              </div>
            ) : step === "Field" ? (
              <div className="flex-1 flex gap-2">
                <Button
                  onClick={goNext}
                  disabled={!canProceed()}
                  className="flex-1 min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white"
                  data-testid="field-report-next"
                >
                  Photos
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("Review")}
                  disabled={!canProceed()}
                  className="min-h-[48px] px-3"
                  data-testid="field-report-skip-to-review"
                >
                  Review
                </Button>
              </div>
            ) : (
              <Button
                onClick={goNext}
                disabled={!canProceed()}
                className="flex-1 min-h-[48px] bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="field-report-next"
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
