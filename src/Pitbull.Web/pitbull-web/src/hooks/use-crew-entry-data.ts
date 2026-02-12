"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import type {
  MyCrewResult,
  CrewMemberDto,
  CrewMemberProjectDto,
  UseCrewEntryDataReturn,
} from "@/types/crew-entry.types";
import type { CostCode } from "@/lib/types";

interface CostCodeListResult {
  items: CostCode[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Hook to load crew data for the batch entry form.
 * Fetches crew members, their projects, and available cost codes.
 */
export function useCrewEntryData(): UseCrewEntryDataReturn {
  const [crew, setCrew] = useState<CrewMemberDto[]>([]);
  const [projects, setProjects] = useState<CrewMemberProjectDto[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);

  // Load cost codes on mount
  useEffect(() => {
    async function loadCostCodes() {
      try {
        const costCodesRes = await api<CostCodeListResult>(
          "/api/cost-codes?costType=1&pageSize=200"
        );
        setCostCodes(costCodesRes.items);
      } catch {
        console.error("Failed to load cost codes");
      }
    }
    loadCostCodes();
  }, []);

  const loadCrew = useCallback(async (supId: string) => {
    if (!supId) {
      setError("Supervisor ID is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSupervisorId(supId);

    try {
      const result = await api<MyCrewResult>(
        `/api/employees/my-crew?supervisorId=${supId}`
      );

      setCrew(result.crewMembers);

      // Collect unique projects from all crew members
      const projectMap = new Map<string, CrewMemberProjectDto>();
      result.crewMembers.forEach((member) => {
        member.assignedProjects.forEach((project) => {
          if (project.isActive && !projectMap.has(project.projectId)) {
            projectMap.set(project.projectId, project);
          }
        });
      });
      setProjects(Array.from(projectMap.values()));

      if (result.crewMembers.length === 0) {
        toast.info("No crew members assigned to you");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load crew";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    crew,
    projects,
    costCodes,
    isLoading,
    error,
    supervisorId,
    loadCrew,
  };
}
