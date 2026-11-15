import { Toaster } from "sonner";

export function GlobalToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      toastOptions={{
        style: { borderRadius: "0" },
        actionButtonStyle: { borderRadius: "0" },
        cancelButtonStyle: { borderRadius: "0" },
      }}
    />
  );
}
