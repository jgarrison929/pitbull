"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface HealthScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

function getScoreColor(score: number): { ring: string; text: string; bg: string; label: string } {
  if (score >= 80) {
    return {
      ring: "stroke-emerald-500",
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      label: "Excellent",
    };
  }
  if (score >= 60) {
    return {
      ring: "stroke-amber-500",
      text: "text-amber-600",
      bg: "bg-amber-50",
      label: "Good",
    };
  }
  if (score >= 40) {
    return {
      ring: "stroke-orange-500",
      text: "text-orange-600",
      bg: "bg-orange-50",
      label: "At Risk",
    };
  }
  return {
    ring: "stroke-red-500",
    text: "text-red-600",
    bg: "bg-red-50",
    label: "Critical",
  };
}

const sizeConfig = {
  sm: { width: 64, strokeWidth: 4, fontSize: "text-lg", labelSize: "text-[10px]" },
  md: { width: 96, strokeWidth: 6, fontSize: "text-2xl", labelSize: "text-xs" },
  lg: { width: 140, strokeWidth: 8, fontSize: "text-4xl", labelSize: "text-sm" },
};

export function HealthScoreGauge({
  score,
  size = "md",
  showLabel = true,
  animated = true,
  className,
}: HealthScoreGaugeProps) {
  const [displayScore, setDisplayScore] = React.useState(animated ? 0 : score);
  const colors = getScoreColor(score);
  const config = sizeConfig[size];
  
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = ((100 - displayScore) / 100) * circumference;

  // Animate the score counting up
  React.useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    const duration = 1000; // 1 second
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, animated]);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: config.width, height: config.width }}>
        {/* Background circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={config.width}
          height={config.width}
        >
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            className={cn(colors.ring, animated && "transition-all duration-1000 ease-out")}
          />
        </svg>
        
        {/* Center score display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums", config.fontSize, colors.text)}>
            {displayScore}
          </span>
        </div>
      </div>
      
      {showLabel && (
        <span className={cn("font-medium", config.labelSize, colors.text)}>
          {colors.label}
        </span>
      )}
    </div>
  );
}

// Mini version for dashboard cards
export function HealthScoreBadge({ score, className }: { score: number; className?: string }) {
  const colors = getScoreColor(score);
  
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        colors.bg,
        className
      )}
    >
      <div
        className={cn("h-2 w-2 rounded-full", {
          "bg-emerald-500": score >= 80,
          "bg-amber-500": score >= 60 && score < 80,
          "bg-orange-500": score >= 40 && score < 60,
          "bg-red-500": score < 40,
        })}
      />
      <span className={cn("text-xs font-semibold tabular-nums", colors.text)}>
        {score}
      </span>
    </div>
  );
}
