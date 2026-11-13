import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Activity, Home, Search } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hidden items-center gap-2 border bg-white px-3 py-2 text-sm text-muted-foreground sm:flex" aria-label="Open command palette">
        <Search className="h-4 w-4" /> Search <kbd className="ml-8 border px-1 text-[10px]">⌘ K</kbd>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-transparent px-4 pt-[15vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <Command className="w-full max-w-lg border bg-white shadow-xl" label="Command menu">
            <div className="flex items-center border-b px-3"><Search className="mr-2 h-4 w-4 text-muted-foreground" /><Command.Input autoFocus placeholder="Type a command or search…" className="h-12 w-full bg-transparent text-sm outline-none" /></div>
            <Command.List className="max-h-72 overflow-auto p-2">
              <Command.Empty className="p-4 text-sm text-muted-foreground">No results found.</Command.Empty>
              <Command.Group heading="Navigate" className="px-2 py-1 text-xs text-muted-foreground">
                <Command.Item onSelect={() => { navigate("/"); setOpen(false); }} className="flex cursor-pointer items-center gap-2 p-2 text-sm aria-selected:bg-muted"><Home className="h-4 w-4" />Dashboard</Command.Item>
                <Command.Item onSelect={() => { navigate("/tasks"); setOpen(false); }} className="flex cursor-pointer items-center gap-2 p-2 text-sm aria-selected:bg-muted"><Activity className="h-4 w-4" />Background tasks</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </div>,
        document.body,
      )}
    </>
  );
}
