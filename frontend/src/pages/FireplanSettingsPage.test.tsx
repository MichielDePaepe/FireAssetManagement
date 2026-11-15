import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { FireplanSettingsPage } from "@/pages/FireplanSettingsPage";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/api", () => ({
  api: {
    getFireplanCredentials: vi.fn(),
    saveFireplanCredentials: vi.fn(),
    testFireplanLogin: vi.fn(),
  },
}));

const savedCredentials = {
  login: "pager-user",
  password_configured: true,
  session_configured: true,
  session_checked_at: "2026-11-13T10:00:00Z",
  updated_at: "2026-11-13T10:00:00Z",
};

describe("FireplanSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFireplanCredentials).mockResolvedValue(savedCredentials);
  });

  it("shows saved login without revealing the password", async () => {
    render(<FireplanSettingsPage />);

    expect(await screen.findByLabelText("Login")).toHaveValue("pager-user");
    expect(screen.getByLabelText("Wachtwoord")).toHaveValue("");
    expect(screen.getByText(/versleuteld wachtwoord opgeslagen/)).toBeInTheDocument();
  });

  it("saves a replacement password without changing the stored session locally", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveFireplanCredentials).mockResolvedValue(savedCredentials);
    render(<FireplanSettingsPage />);

    await user.clear(await screen.findByLabelText("Login"));
    await user.type(screen.getByLabelText("Login"), "new-user");
    await user.type(screen.getByLabelText("Wachtwoord"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Gegevens opslaan" }));

    await waitFor(() => expect(api.saveFireplanCredentials).toHaveBeenCalledWith({
      login: "new-user",
      password: "new-secret",
    }));
    expect(screen.getByLabelText("Wachtwoord")).toHaveValue("");
  });

  it("checks Fireplan login only when requested", async () => {
    const user = userEvent.setup();
    vi.mocked(api.testFireplanLogin).mockResolvedValue({
      ok: true,
      detail: "Bestaande Fireplan-sessie is nog geldig en werd hergebruikt.",
      session_reused: true,
      session_configured: true,
      session_checked_at: "2026-11-13T10:01:00Z",
    });
    render(<FireplanSettingsPage />);

    await user.click(await screen.findByRole("button", { name: "Fireplan-login testen" }));

    await waitFor(() => expect(api.testFireplanLogin).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith(
      "Bestaande Fireplan-sessie is nog geldig en werd hergebruikt.",
    );
  });
});
