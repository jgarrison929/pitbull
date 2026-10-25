/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildOwnerRegisterPayload } from "@/lib/owner-register-payload";

const registerMock = vi.fn().mockResolvedValue(undefined);
const pushMock = vi.fn();

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ register: registerMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  default: vi.fn().mockResolvedValue({}),
}));

import SignupPage from "@/app/(auth)/signup/page";

describe("SignupPage wizard submit", () => {
  beforeEach(() => {
    registerMock.mockClear();
    pushMock.mockClear();
  });

  it("calls register with buildOwnerRegisterPayload output", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText(/first name/i), "Test");
    await user.type(screen.getByLabelText(/last name/i), "Owner");
    await user.type(screen.getByLabelText(/^email$/i), "wizard@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123");
    await user.type(screen.getByLabelText(/confirm password/i), "SecurePass123");
    await user.click(screen.getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByRole("heading", { name: /set up your company/i });
    await user.type(screen.getByLabelText(/company name/i), "Acme 123 LLC");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByRole("heading", { name: /invite your team/i });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));

    const expected = buildOwnerRegisterPayload({
      firstName: "Test",
      lastName: "Owner",
      email: "wizard@example.com",
      password: "SecurePass123",
      companyName: "Acme 123 LLC",
      industryType: "",
      employeeRange: "",
    });
    expect(registerMock).toHaveBeenCalledWith(expected);
  });
});