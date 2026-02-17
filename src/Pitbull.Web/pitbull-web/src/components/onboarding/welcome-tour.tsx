"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";

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
  const hasFetched = useRef(false);

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

  async function markStepSeen(stepId: string) {
    try {
      await api(`/api/onboarding/tour/steps/${stepId}/seen`, {
        method: "POST",
      });
    } catch {
      // Non-critical
    }
  }

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
    markStepSeen(step.id);

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
    markStepSeen(step.id);
    router.push(`/${step.targetPage}`);
  }

  if (!visible || !tour || tour.steps.length === 0) return null;

  const step = tour.steps[currentIndex];
  const isLast = currentIndex === tour.steps.length - 1;
  const isFirst = currentIndex === 0;

  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleSkip} />

      {/* Tour modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
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
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-2xl font-bold">{step.title}</h2>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-slate-600 leading-relaxed">{step.description}</p>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mt-6 mb-4">
              {tour.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex
                      ? "bg-blue-600"
                      : i < currentIndex
                      ? "bg-blue-300"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {!isFirst && (
                  <Button variant="outline" size="sm" onClick={handlePrev}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip tour
                </Button>
              </div>
              <div className="flex gap-2">
                {step.targetPage !== "dashboard" && (
                  <Button variant="outline" size="sm" onClick={handleGoToPage}>
                    Go to {step.title}
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {isLast ? "Finish" : "Next"}
                  {!isLast && <ArrowRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
