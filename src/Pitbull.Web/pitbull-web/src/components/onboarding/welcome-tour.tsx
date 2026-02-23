"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { ArrowRight, ArrowLeft, X, Sparkles, MapPin } from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetPage: string;
  order: number;
  isSeen: boolean;
}

interface TourData {
  isNewUser: boolean;
  steps: TourStep[];
  seenStepIds: string[];
  isComplete: boolean;
}

export function WelcomeTour() {
  const [tour, setTour] = useState<TourData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const hasFetched = useRef(false);
  const markedSeenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;
    async function loadTour() {
      try {
        const data = await api<TourData>("/api/onboarding/tour");
        if (cancelled) return;
        setTour(data);
        if (data.isNewUser && !data.isComplete) {
          setVisible(true);
          const firstUnseen = data.steps.findIndex((s) => !s.isSeen);
          if (firstUnseen >= 0) setCurrentIndex(firstUnseen);
        }
      } catch {
        // Tour unavailable — not critical
      }
    }
    loadTour();
    return () => { cancelled = true; };
  }, []);

  // Determine if the user is currently on the step's target page
  const isOnTargetPage = useMemo(() => {
    if (!tour || !visible) return false;
    const step = tour.steps[currentIndex];
    if (!step) return false;
    if (step.targetPage === "dashboard") return pathname === "/";
    return (
      pathname === `/${step.targetPage}` ||
      pathname.startsWith(`/${step.targetPage}/`)
    );
  }, [tour, visible, currentIndex, pathname]);

  async function markStepSeen(stepId: string) {
    try {
      await api(`/api/onboarding/tour/steps/${stepId}/seen`, {
        method: "POST",
      });
    } catch {
      // Non-critical
    }
  }

  // Auto-mark step as seen when user navigates to its target page
  useEffect(() => {
    if (!isOnTargetPage || !tour) return;
    const step = tour.steps[currentIndex];
    if (!step || markedSeenRef.current.has(step.id)) return;
    markedSeenRef.current.add(step.id);
    markStepSeen(step.id);
  }, [isOnTargetPage, tour, currentIndex]);

  async function completeTour() {
    try {
      await api("/api/onboarding/tour/complete", { method: "POST" });
    } catch {
      // Non-critical
    }
    setVisible(false);
  }

  function handleNext() {
    if (!tour) return;
    const step = tour.steps[currentIndex];
    if (!markedSeenRef.current.has(step.id)) {
      markedSeenRef.current.add(step.id);
      markStepSeen(step.id);
    }

    if (currentIndex < tour.steps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      completeTour();
    }
  }

  function handlePrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function handleSkip() {
    completeTour();
  }

  function handleGoToPage() {
    if (!tour) return;
    const step = tour.steps[currentIndex];
    if (!markedSeenRef.current.has(step.id)) {
      markedSeenRef.current.add(step.id);
      markStepSeen(step.id);
    }
    router.push(`/${step.targetPage}`);
  }

  if (!visible || !tour || tour.steps.length === 0) return null;

  const step = tour.steps[currentIndex];
  const isLast = currentIndex === tour.steps.length - 1;
  const isFirst = currentIndex === 0;

  // Compact bottom-right panel when user is on the target page
  if (isOnTargetPage) {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-full max-w-sm sm:bottom-6 sm:right-6">
        <div className="bg-background rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Compact header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Step {currentIndex + 1} of {tour.steps.length}
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="text-sm font-medium mb-1">{step.title}</p>
            <p className="text-xs text-muted-foreground mb-4">
              You&apos;re here! Take a look around, then continue when ready.
            </p>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {tour.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === currentIndex
                      ? "bg-blue-600 dark:bg-blue-500"
                      : i < currentIndex
                      ? "bg-blue-300 dark:bg-blue-700"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={handlePrev}>
                    <ArrowLeft className="w-3 h-3 mr-1" /> Back
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSkip}>
                  Skip
                </Button>
              </div>
              <Button size="sm" className="min-w-[80px]" onClick={handleNext}>
                {isLast ? "🎉 Finish" : "Next"}
                {!isLast && <ArrowRight className="w-3 h-3 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Center modal when NOT on the target page
  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleSkip} />

      {/* Tour modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">
                  Step {currentIndex + 1} of {tour.steps.length}
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Close tour"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-2xl font-bold">{step.title}</h2>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-muted-foreground leading-relaxed mb-6">{step.description}</p>

            {/* "Go to page" button — standalone row so it doesn't crowd nav */}
            {step.targetPage !== "dashboard" && (
              <Button
                variant="outline"
                className="w-full mb-4"
                onClick={handleGoToPage}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Go to {step.title}
              </Button>
            )}

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-5">
              {tour.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex
                      ? "bg-blue-600 dark:bg-blue-500"
                      : i < currentIndex
                      ? "bg-blue-300 dark:bg-blue-700"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Navigation — clean row: Back | Skip ... Next/Finish */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={handlePrev}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSkip}>
                  Skip tour
                </Button>
              </div>
              <Button onClick={handleNext} className="min-w-[100px]">
                {isLast ? "🎉 Finish" : "Next"}
                {!isLast && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
