import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  default: "bg-primary text-primary-foreground",
  muted: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
};

export function Badge({ className, tone = "muted", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center border border-transparent px-2.5 py-0.5 text-xs font-semibold rounded-sm", tones[tone], className)} {...props} />;
}
