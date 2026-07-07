import { describe, it, expect } from "vitest";
import {
  buildOwnerRegisterPayload,
  isValidOwnerName,
  OWNER_NAME_PATTERN,
} from "@/lib/owner-register-payload";

describe("buildOwnerRegisterPayload", () => {
  const base = {
    firstName: "  Test  ",
    lastName: " Owner ",
    email: "  owner@example.com ",
    password: "SecurePass123",
    companyName: "  Acme 123 Construction LLC  ",
    industryType: " general-contractor ",
    employeeRange: " 11-50 ",
  };

  it("trims names and email; keeps digits in companyName", () => {
    const payload = buildOwnerRegisterPayload(base);
    expect(payload.firstName).toBe("Test");
    expect(payload.lastName).toBe("Owner");
    expect(payload.email).toBe("owner@example.com");
    expect(payload.companyName).toBe("Acme 123 Construction LLC");
    expect(payload.industryType).toBe("general-contractor");
    expect(payload.employeeRange).toBe("11-50");
  });

  it("omits empty optional fields", () => {
    const payload = buildOwnerRegisterPayload({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      password: "SecurePass123",
      companyName: "   ",
      industryType: "",
      employeeRange: undefined,
    });
    expect(payload.companyName).toBeUndefined();
    expect(payload.industryType).toBeUndefined();
    expect(payload.employeeRange).toBeUndefined();
  });

  it("rejects invalid name characters per API validator pattern", () => {
    expect(isValidOwnerName("E2E")).toBe(false);
    expect(isValidOwnerName("Test")).toBe(true);
    expect(isValidOwnerName("Mary-Jane")).toBe(true);
    expect(isValidOwnerName("O'Brien")).toBe(true);
    expect(OWNER_NAME_PATTERN.test("Test")).toBe(true);
    expect(OWNER_NAME_PATTERN.test("E2E")).toBe(false);
  });
});