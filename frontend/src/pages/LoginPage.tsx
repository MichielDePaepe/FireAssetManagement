import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
type LoginFields = z.infer<typeof schema>;

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<LoginFields>({ resolver: zodResolver(schema) });
  if (!loading && user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/"} replace />;

  const submit = handleSubmit(async ({ username, password }) => {
    setError("");
    try {
      await signIn(username, password);
      navigate("/", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed");
    }
  });

  return <div className="grid min-h-screen place-items-center bg-muted/50 p-4">
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="space-y-4">
        <img className="h-auto w-44" src="/logo-asset-management.svg" alt="Brandweer Brussel Asset Management" />
        <div><CardTitle>Sign in</CardTitle><CardDescription className="mt-2">Sign in to open your project workspace.</CardDescription></div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2"><label htmlFor="username" className="text-sm font-medium">Username</label><Input id="username" autoComplete="username" {...register("username")} aria-invalid={Boolean(errors.username)} /></div>
          <div className="space-y-2"><label htmlFor="password" className="text-sm font-medium">Password</label><Input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={Boolean(errors.password)} /></div>
          {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting || loading}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="mt-5 text-xs text-muted-foreground">Use an account configured for this environment.</p>
      </CardContent>
    </Card>
  </div>;
}
