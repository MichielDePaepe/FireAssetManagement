import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, Flashlight, FlashlightOff, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

interface PagerScanControlProps {
  onScan: (rawScan: string) => Promise<void> | void;
}

export function PagerScanControl({ onScan }: PagerScanControlProps) {
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [pending, setPending] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cssZoom, setCssZoom] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const pendingRef = useRef(false);
  const detectedRef = useRef(false);
  const submitScanRef = useRef<(rawScan: string) => void>(() => undefined);

  useEffect(() => {
    if (keyboardMode) inputRef.current?.focus();
  }, [keyboardMode]);

  useEffect(() => {
    if (!keyboardMode) return;
    const deactivateOutside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) setKeyboardMode(false);
    };
    document.addEventListener("pointerdown", deactivateOutside, true);
    document.addEventListener("focusin", deactivateOutside, true);
    return () => {
      document.removeEventListener("pointerdown", deactivateOutside, true);
      document.removeEventListener("focusin", deactivateOutside, true);
    };
  }, [keyboardMode]);

  function stopCamera() {
    generationRef.current += 1;
    if (scanTimeoutRef.current !== null) window.clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraMode(false);
    setTorchEnabled(false);
  }

  async function submitScan(rawScan: string) {
    if (!rawScan || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setKeyboardMode(false);
    try {
      await onScan(rawScan);
    } catch {
      // The caller owns scan feedback, such as an error toast.
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  submitScanRef.current = (rawScan) => {
    void submitScan(rawScan);
  };

  async function setTorch(enabled: boolean) {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled } as unknown as MediaTrackConstraintSet] });
      setTorchEnabled(enabled);
    } catch {
      setTorchSupported(false);
      setTorchEnabled(false);
    }
  }

  useEffect(() => {
    if (!cameraMode) return;
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const generation = ++generationRef.current;
    detectedRef.current = false;
    setCameraError(null);
    setTorchSupported(false);
    setTorchEnabled(false);
    setCssZoom(true);

    const reader = new BrowserQRCodeReader();
    void reader.decodeFromVideoDevice(undefined, videoElement, (result) => {
      if (!result || pendingRef.current || detectedRef.current || generationRef.current !== generation) return;
      detectedRef.current = true;
      setScanFlash(true);
      scanTimeoutRef.current = window.setTimeout(() => {
        scanTimeoutRef.current = null;
        controlsRef.current?.stop();
        controlsRef.current = null;
        setCameraMode(false);
        setScanFlash(false);
        setTorchEnabled(false);
        submitScanRef.current(result.getText());
      }, 220);
    }).then(async (controls) => {
      if (generationRef.current !== generation) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      const track = (videoElement.srcObject as MediaStream | null)?.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        torch?: boolean;
        zoom?: { min: number; max: number };
      };
      setTorchSupported(Boolean(capabilities.torch));
      if (capabilities.zoom && capabilities.zoom.min <= 1.3 && capabilities.zoom.max >= 1.3) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: 1.3 } as unknown as MediaTrackConstraintSet] });
          setCssZoom(false);
        } catch {
          setCssZoom(true);
        }
      }
    }).catch(() => {
      if (generationRef.current === generation) {
        setCameraError("De camera kon niet worden gestart. Controleer de toestemming en beveiligde browserverbinding.");
      }
    });

    return () => {
      generationRef.current += 1;
      if (scanTimeoutRef.current !== null) window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraMode]);

  useEffect(() => () => {
    generationRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        variant={keyboardMode ? "destructive" : "outline"}
        onClick={() => setKeyboardMode((active) => !active)}
        disabled={cameraMode || pending}
        aria-pressed={keyboardMode}
        aria-label={keyboardMode ? "Scanmodus uitschakelen" : "Scanmodus inschakelen"}
        title={keyboardMode ? "Scanmodus uitschakelen" : "Scannen met handscanner"}
        size="icon"
        className="h-9 w-9 p-0"
      >
        {keyboardMode ? <X className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant={cameraMode ? "secondary" : "outline"}
        onClick={() => {
          setKeyboardMode(false);
          setCameraError(null);
          setCameraMode(true);
        }}
        disabled={keyboardMode || pending}
        aria-label="Camera scannen"
        title="Scannen met camera"
        size="icon"
        className="h-9 w-9 p-0"
      >
        <Camera className="h-4 w-4" />
      </Button>
      <input
        ref={inputRef}
        aria-label="Scaninvoer"
        className="sr-only"
        tabIndex={keyboardMode ? 0 : -1}
        value={undefined}
        onChange={(event) => {
          if (inputRef.current) inputRef.current.value = event.target.value;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const rawScan = event.currentTarget.value;
          event.currentTarget.value = "";
          setKeyboardMode(false);
          void submitScan(rawScan);
        }}
      />
      {cameraMode && createPortal(
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) stopCamera(); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="pager-camera-title" className="w-full max-w-[min(90vw,26rem)] border bg-background p-3 shadow-xl">
            <header className="mb-2 flex items-center justify-between gap-3">
              <h2 id="pager-camera-title" className="text-sm font-medium">Pager scannen</h2>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Camera stoppen" title="Scannervenster sluiten" autoFocus onClick={stopCamera}>
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="relative aspect-square w-full overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Camerabeeld voor het scannen van een pager"
                className={`h-full w-full object-cover ${cssZoom ? "scale-[1.3]" : ""}`}
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-[13%]">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-primary" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-[3px] border-r-[3px] border-primary" />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute bottom-3 right-3 h-9 w-9 rounded-full border border-white/30 bg-black/65 text-white hover:bg-black/80"
                aria-label={torchEnabled ? "Zaklamp uitschakelen" : "Zaklamp inschakelen"}
                title={torchSupported ? (torchEnabled ? "Zaklamp uitschakelen" : "Zaklamp inschakelen") : "Zaklamp niet beschikbaar op deze camera"}
                disabled={!torchSupported}
                onClick={() => void setTorch(!torchEnabled)}
              >
                {torchEnabled ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
              </Button>
              {scanFlash && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-white/80" />}
              {cameraError && <p role="alert" className="absolute inset-x-3 bottom-3 bg-background/95 p-2 text-center text-xs text-destructive">{cameraError}</p>}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Plaats de QR-code binnen de hoekmarkeringen.</p>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
