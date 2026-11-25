import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/AppLayout";

vi.mock("@/auth/AuthProvider", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe("AppLayout management navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the requested grouped navigation and preserves its routes for staff", async () => {
    mockedUseAuth.mockReturnValue({
      user: { username: "staff", is_staff: true },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
    });

    const user = userEvent.setup();
    render(<MemoryRouter><AppLayout /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Labelprinters" })).toHaveAttribute(
      "href",
      "/labelprinters",
    );
    expect(screen.getByRole("link", { name: "Background tasks" })).toHaveAttribute("href", "/tasks");
    expect(screen.getByRole("link", { name: "Radio's" })).toHaveAttribute("href", "/radios");
    expect(screen.getByRole("link", { name: "CityGIS" })).toHaveAttribute("href", "/citygis");
    expect(screen.getByRole("link", { name: "Trackers" })).toHaveAttribute("href", "/trackers");
    expect(screen.queryByRole("link", { name: "Toewijzingen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inventarissen" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assetbeheer" }));
    expect(screen.getByRole("link", { name: "Toewijzingen" })).toHaveAttribute("href", "/inventory");
    expect(screen.getByRole("link", { name: "Locaties" })).toHaveAttribute("href", "/locations");

    await user.click(screen.getByRole("button", { name: "FirePlan" }));
    expect(screen.getByRole("link", { name: "Inventarissen" })).toHaveAttribute(
      "href",
      "/fireplan/inventories",
    );
    expect(screen.getByRole("link", { name: "Credentials" })).toHaveAttribute("href", "/fireplan");
  });

  it("hides the label-printer link from non-staff users", () => {
    mockedUseAuth.mockReturnValue({
      user: { username: "user", is_staff: false },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
    });

    render(<MemoryRouter><AppLayout /></MemoryRouter>);

    expect(screen.queryByRole("link", { name: "Labelprinters" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Background tasks" })).toHaveAttribute("href", "/tasks");
    expect(screen.getByRole("link", { name: "Radio's" })).toHaveAttribute("href", "/radios");
    expect(screen.queryByRole("button", { name: "Assetbeheer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "FirePlan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "CityGIS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Trackers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Locaties" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inventarissen" })).not.toBeInTheDocument();
  });
});
