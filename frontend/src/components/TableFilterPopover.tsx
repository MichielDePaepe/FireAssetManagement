import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TableFilterOption {
  value: string;
  label: string;
}

export function TableFilterPopover({ anchor, label, options, selected, onChange, onClose }: {
  anchor: HTMLElement;
  label: string;
  options: TableFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const panelWidth = 280;
      const panelHeight = Math.min(panelRef.current?.offsetHeight ?? 320, window.innerHeight - 16);
      const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
      const left = Math.min(Math.max(8, rect.left), maxLeft);
      const below = rect.bottom + 4;
      const top = below + panelHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - panelHeight - 4);
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, options.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="group"
      aria-label={`Filter op ${label.toLocaleLowerCase("nl-BE")}`}
      className="fixed z-50 max-h-80 w-[17.5rem] max-w-[calc(100vw-1rem)] overflow-y-auto border bg-white p-3 text-sm text-foreground shadow-lg"
      style={{ ...position, maxHeight: "min(20rem, calc(100vh - 1rem))" }}
    >
      <div className="mb-2 flex items-center justify-between border-b pb-2">
        <span className="font-semibold">Filter op {label.toLocaleLowerCase("nl-BE")}</span>
        <button
          type="button"
          className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          disabled={!selected.length}
          onClick={() => { onChange([]); onClose(); }}
        >Wissen</button>
      </div>
      <div className="space-y-1">
        {options.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={selected.includes(option.value)}
            onChange={(event) => {
              onChange(event.target.checked
                ? [...selected, option.value]
                : selected.filter((value) => value !== option.value));
              onClose();
            }}
          />
          <span>{option.label}</span>
        </label>)}
        {!options.length && <p className="px-2 py-1.5 text-muted-foreground">Geen filteropties beschikbaar.</p>}
      </div>
    </div>,
    document.body,
  );
}
