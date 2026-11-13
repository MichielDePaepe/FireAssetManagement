import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function Progress({ className, value, ...props }: ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root className={cn("relative h-3 w-full overflow-hidden bg-secondary rounded-none", className)} {...props}>
      <ProgressPrimitive.Indicator className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-out rounded-none" style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }} />
    </ProgressPrimitive.Root>
  );
}
