/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormAutosave } from "./use-form-autosave";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  };
}

describe("useFormAutosave excludeKeys (3.2.0 PII)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not persist excluded sensitive keys to localStorage", () => {
    const data = {
      firstName: "Pat",
      lastName: "Lee",
      employeeNumber: "EMP-99",
      email: "pat@example.com",
      emergencyContactPhone: "555-0100",
    };

    renderHook(() =>
      useFormAutosave("employee-new", data, {
        enabled: true,
        debounceMs: 10,
        excludeKeys: ["employeeNumber", "email", "emergencyContactPhone"] as const,
      })
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    const raw = localStorage.getItem("draft:employee-new");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!) as Record<string, unknown>;
    expect(stored.firstName).toBe("Pat");
    expect(stored.lastName).toBe("Lee");
    expect(stored.employeeNumber).toBeUndefined();
    expect(stored.email).toBeUndefined();
    expect(stored.emergencyContactPhone).toBeUndefined();
  });
});
