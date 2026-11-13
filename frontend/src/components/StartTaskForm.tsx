import { zodResolver } from "@hookform/resolvers/zod";
import { Play } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({ duration: z.coerce.number().int().min(5).max(60) });
type InputValues = z.input<typeof schema>;
type OutputValues = z.output<typeof schema>;

export function StartTaskForm({ onStart, busy = false }: { onStart: (duration: number) => Promise<void>; busy?: boolean }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InputValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: { duration: 30 },
  });
  const submit = handleSubmit(async ({ duration }) => onStart(duration));
  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="max-w-xs space-y-2">
        <label className="text-sm font-medium" htmlFor="duration">Duration in seconds</label>
        <Input id="duration" type="number" min={5} max={60} {...register("duration")} aria-invalid={Boolean(errors.duration)} />
        {errors.duration && <p className="text-sm text-red-600">Choose a whole number from 5 to 60.</p>}
        <p className="text-xs text-muted-foreground">The example task reports progress once per second.</p>
      </div>
      <Button type="submit" disabled={busy || isSubmitting}>
        <Play className="h-4 w-4" /> {busy || isSubmitting ? "Starting…" : "Start example task"}
      </Button>
    </form>
  );
}
