import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GlobalToaster } from "@/components/GlobalToaster";
import { toast } from "sonner";

describe("GlobalToaster", () => {
  afterEach(() => toast.dismiss());

  it("places notifications at the bottom right with square corners", async () => {
    render(<GlobalToaster />);
    toast.success("Toaster-position-test", {
      action: { label: "Rapport bekijken", onClick: () => undefined },
    });

    expect(await screen.findByText("Toaster-position-test")).toBeInTheDocument();
    const toaster = document.querySelector("[data-sonner-toaster]");
    expect(toaster).toHaveAttribute("data-y-position", "bottom");
    expect(toaster).toHaveAttribute("data-x-position", "right");
    await waitFor(() =>
      expect(screen.getByText("Toaster-position-test").closest("[data-sonner-toast]")).toHaveStyle({
        borderRadius: "0",
      }),
    );
    expect(screen.getByRole("button", { name: "Rapport bekijken" })).toHaveStyle({ borderRadius: "0" });
  });
});
