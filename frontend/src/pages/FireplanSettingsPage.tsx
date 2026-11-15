import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type FireplanCredentials } from "@/lib/api";

export function FireplanSettingsPage() {
  const [credentials, setCredentials] = useState<FireplanCredentials | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const credentialsHaveUnsavedChanges = Boolean(
    credentials && (login.trim() !== credentials.login || password.length > 0),
  );

  useEffect(() => {
    let active = true;
    api.getFireplanCredentials()
      .then((saved) => {
        if (!active) return;
        setCredentials(saved);
        setLogin(saved.login);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Instellingen laden is niet gelukt.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const values = { login: login.trim(), ...(password ? { password } : {}) };
      const saved = await api.saveFireplanCredentials(values);
      setCredentials(saved);
      setLogin(saved.login);
      setPassword("");
      toast.success("Fireplan-inloggegevens versleuteld opgeslagen.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  };

  const testLogin = async () => {
    setTesting(true);
    setError("");
    try {
      const result = await api.testFireplanLogin();
      setCredentials((saved) => saved ? {
        ...saved,
        session_configured: result.session_configured,
        session_checked_at: result.session_checked_at,
      } : saved);
      toast.success(result.detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fireplan-login is niet gelukt.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-7">
      <div>
        <p className="text-sm font-medium text-primary">Beheer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Fireplan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configureer de accountgegevens waarmee deze toepassing zich bij Fireplan aanmeldt.
        </p>
      </div>

      {error && <div role="alert" className="border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-muted"><KeyRound className="h-5 w-5" /></span>
            <div>
              <CardTitle>Fireplan-login</CardTitle>
              <CardDescription className="mt-2">
                Het wachtwoord wordt versleuteld in de database bewaard en is hierna niet meer leesbaar.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />Instellingen laden…
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(event) => void save(event)}>
              <div className="space-y-2">
                <label htmlFor="fireplan-login" className="text-sm font-medium">Login</label>
                <Input
                  id="fireplan-login"
                  autoComplete="username"
                  required
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="fireplan-password" className="text-sm font-medium">Wachtwoord</label>
                <Input
                  id="fireplan-password"
                  type="password"
                  autoComplete="new-password"
                  required={!credentials?.password_configured}
                  placeholder={credentials?.password_configured ? "Leeg laten om te behouden" : "Fireplan-wachtwoord"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving || loading}>
                  {saving ? "Opslaan…" : "Gegevens opslaan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void testLogin()}
                  disabled={
                    !credentials?.password_configured ||
                    credentialsHaveUnsavedChanges ||
                    saving ||
                    testing
                  }
                >
                  <ShieldCheck className="h-4 w-4" />
                  {testing ? "Fireplan-login testen…" : "Fireplan-login testen"}
                </Button>
              </div>
            </form>
          )}
          {credentials?.password_configured && !loading && (
            <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
              Er is een versleuteld wachtwoord opgeslagen. Laat het wachtwoordveld leeg om dit te behouden.
            </p>
          )}
          {credentials?.session_configured && credentials.session_checked_at && !loading && (
            <p className="mt-2 text-xs text-muted-foreground">
              Fireplan-sessie laatst gecontroleerd: {new Date(credentials.session_checked_at).toLocaleString()}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
