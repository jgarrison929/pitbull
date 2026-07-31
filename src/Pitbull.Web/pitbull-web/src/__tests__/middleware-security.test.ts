import { describe, it, expect } from "vitest";
import { hasAdminRole, safeMiddlewareRedirect } from "@/middleware";

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

describe("safeMiddlewareRedirect", () => {
  it("allows same-app relative paths", () => {
    expect(safeMiddlewareRedirect("/projects")).toBe("/projects");
    expect(safeMiddlewareRedirect("/admin/users")).toBe("/admin/users");
  });

  it("blocks open-redirect shapes", () => {
    expect(safeMiddlewareRedirect("//evil.example")).toBe("/");
    expect(safeMiddlewareRedirect("/\\evil.example")).toBe("/");
    expect(safeMiddlewareRedirect("/@evil")).toBe("/");
    expect(safeMiddlewareRedirect("https://evil.example")).toBe("/");
    expect(safeMiddlewareRedirect("not-a-path")).toBe("/");
  });
});

describe("hasAdminRole", () => {
  it("accepts logical Admin role", () => {
    expect(hasAdminRole({ [ROLE_CLAIM]: "Admin" })).toBe(true);
    expect(hasAdminRole({ [ROLE_CLAIM]: ["User", "Admin"] })).toBe(true);
  });

  it("accepts tenant-prefixed Admin role", () => {
    expect(hasAdminRole({ [ROLE_CLAIM]: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:Admin" })).toBe(true);
  });

  it("rejects non-admin roles", () => {
    expect(hasAdminRole({ [ROLE_CLAIM]: "Manager" })).toBe(false);
    expect(hasAdminRole({ [ROLE_CLAIM]: ["User", "Supervisor"] })).toBe(false);
    expect(hasAdminRole({})).toBe(false);
  });
});
