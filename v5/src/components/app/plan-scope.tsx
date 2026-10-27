"use client";

import { createContext, useContext, type ReactNode } from "react";

export type PlanScopeValue = {
  jobNumber: string;
  crew: string;
  /** ISO date (YYYY-MM-DD) of the plan. */
  planDate: string;
};

const PlanScopeContext = createContext<PlanScopeValue | null>(null);

/** Lets approve/return forms name the crew and day without editing the job page. */
export function PlanScope({
  jobNumber,
  crew,
  planDate,
  children,
}: PlanScopeValue & { children: ReactNode }) {
  return (
    <PlanScopeContext.Provider value={{ jobNumber, crew, planDate }}>
      {children}
    </PlanScopeContext.Provider>
  );
}

export function usePlanScope(): PlanScopeValue | null {
  return useContext(PlanScopeContext);
}
