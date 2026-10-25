"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "pitbull-recent-projects";
const MAX_RECENT_PROJECTS = 5;

export interface RecentProject {
  id: string;
  name: string;
  number: string;
  viewedAt: number;
}

/**
 * Hook for managing recently viewed projects in localStorage.
 * Persists the last 5 projects the user visited.
 */
export function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as RecentProject[];
      }
    } catch {
      // Invalid data, clear it
      localStorage.removeItem(STORAGE_KEY);
    }
    return [];
  });

  // Add a project to recent history
  const addRecentProject = useCallback(
    (project: { id: string; name: string; number: string }) => {
      setRecentProjects((prev) => {
        // Remove if already exists
        const filtered = prev.filter((p) => p.id !== project.id);
        
        // Add to front with current timestamp
        const updated = [
          { ...project, viewedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_PROJECTS);

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // localStorage might be full or unavailable
        }

        return updated;
      });
    },
    []
  );

  // Clear all recent projects
  const clearRecentProjects = useCallback(() => {
    setRecentProjects([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentProjects,
    addRecentProject,
    clearRecentProjects,
  };
}
