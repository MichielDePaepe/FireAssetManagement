import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserQRCodeReader } from "@zxing/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagerScanControl } from "./PagerScanControl";

const decoder = vi.hoisted(() => ({
  callback: undefined as ((result: { getText: () => string } | undefined) => void) | undefined,
  stop: vi.fn(),
}));

vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoDevice: vi.fn(async (_device: unknown, _video: unknown, callback: typeof decoder.callback) => {
      decoder.callback = callback;
      return { stop: decoder.stop };
    }),
  })),
}));

describe("PagerScanControl", () => {
  beforeEach(() => {
    decoder.callback = undefined;
    decoder.stop.mockClear();
    vi.mocked(BrowserQRCodeReader).mockClear();
  });

  it("submits one keyboard scan and leaves scan mode", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn().mockResolvedValue(undefined);
    render(<PagerScanControl onScan={onScan} />);

    await user.click(screen.getByRole("button", { name: "Scanmodus inschakelen" }));
    const input = screen.getByLabelText("Scaninvoer");
    await user.type(input, "https://infoscan.firebru.brussels?data=1,1,4321,1010{Enter}");

    await waitFor(() => expect(onScan).toHaveBeenCalledWith("https://infoscan.firebru.brussels?data=1,1,4321,1010"));
    expect(screen.getByRole("button", { name: "Scanmodus inschakelen" })).toBeInTheDocument();
  });

  it("deactivates keyboard scan mode when focus moves to another field", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PagerScanControl onScan={vi.fn()} />
        <input aria-label="Ander veld" />
      </>,
    );

    const scanButton = screen.getByRole("button", { name: "Scanmodus inschakelen" });
    await user.click(scanButton);
    expect(screen.getByRole("button", { name: "Scanmodus uitschakelen" })).toHaveClass("bg-destructive");

    await user.click(screen.getByRole("textbox", { name: "Ander veld" }));

    expect(screen.getByRole("button", { name: "Scanmodus inschakelen" })).toBeInTheDocument();
  });

  it("stops the camera after one decoded scan", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn().mockResolvedValue(undefined);
    render(<PagerScanControl onScan={onScan} />);

    await user.click(screen.getByRole("button", { name: "Camera scannen" }));
    expect(BrowserQRCodeReader).toHaveBeenCalledOnce();
    await waitFor(() => expect(decoder.callback).toBeTypeOf("function"));

    act(() => decoder.callback?.({ getText: () => "camera-qr" }));

    await waitFor(() => expect(onScan).toHaveBeenCalledWith("camera-qr"));
    expect(decoder.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Camera scannen" })).toBeInTheDocument();
  });

  it("stops camera resources when the user cancels", async () => {
    const user = userEvent.setup();
    render(<PagerScanControl onScan={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Camera scannen" }));
    await waitFor(() => expect(decoder.callback).toBeTypeOf("function"));
    await user.click(screen.getByRole("button", { name: "Camera stoppen" }));

    expect(decoder.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Camera scannen" })).toBeInTheDocument();
  });

  it("stops camera resources when the component unmounts", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PagerScanControl onScan={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Camera scannen" }));
    await waitFor(() => expect(decoder.callback).toBeTypeOf("function"));
    unmount();

    expect(decoder.stop).toHaveBeenCalledOnce();
  });
});
