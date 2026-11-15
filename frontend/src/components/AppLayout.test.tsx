import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/auth/AuthProvider";
import { AppLayout } from "@/components/AppLayout";

vi.mock("@/auth/AuthProvider", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

describe("AppLayout printer navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the label-printer link to staff users", () => {
    mockedUseAuth.mockReturnValue({
      user: { username: "staff", is_staff: true },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
    });

    render(<MemoryRouter><AppLayout /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Labelprinters" })).toHaveAttribute(
      "href",
      "/labelprinters",
    );
    expect(screen.getByRole("link", { name: "Inventaris" })).toHaveAttribute("href", "/inventory");
    expect(screen.getByRole("link", { name: "CityGIS" })).toHaveAttribute("href", "/citygis");
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
    expect(screen.queryByRole("link", { name: "Inventaris" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "CityGIS" })).not.toBeInTheDocument();
  });
});
