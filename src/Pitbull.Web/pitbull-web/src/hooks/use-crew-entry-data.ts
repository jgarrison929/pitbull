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
import type { CostCode, Equipment, ListEquipmentResult } from "@/lib/types";

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
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);

  // Load cost codes and equipment on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [costCodesRes, equipmentRes] = await Promise.all([
          api<CostCodeListResult>("/api/cost-codes?costType=1&pageSize=200"),
          api<ListEquipmentResult>("/api/equipment?isActive=true&pageSize=200"),
        ]);
        setCostCodes(costCodesRes.items);
        setEquipmentList(equipmentRes.items);
      } catch {
        console.error("Failed to load cost codes or equipment");
      }
    }
    loadOptions();
  }, []);

  const loadCrew = useCallback(async (supId?: string) => {
    setIsLoading(true);
    setError(null);
    if (supId) setSupervisorId(supId);

    try {
      // When supId is provided, pass it as a query param (admin/impersonation).
      // When omitted, the backend resolves the supervisor from the JWT email claim.
      const url = supId
        ? `/api/employees/my-crew?supervisorId=${supId}`
        : `/api/employees/my-crew`;
      const result = await api<MyCrewResult>(url);

      // Always set supervisorId from response (backend resolves it when omitted)
      setSupervisorId(result.supervisorId);
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
    equipmentList,
    isLoading,
    error,
    supervisorId,
    loadCrew,
  };
}
