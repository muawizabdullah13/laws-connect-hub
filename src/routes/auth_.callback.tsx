import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    async function finishSignIn() {
      const href = window.location.href;

      // Case 1: Supabase returned tokens directly in the URL hash (#access_token=...)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !data.session) {
          setErrorDetail(error?.message ?? "setSession returned no session and no error.");
          return;
        }
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      // Case 2: Supabase returned a PKCE ?code= param instead
      if (href.includes("code=")) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(href);
        if (error || !data.session) {
          setErrorDetail(error?.message ?? "exchangeCodeForSession returned no session and no error.");
          return;
        }
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      setErrorDetail(`Neither a "code" nor an access_token was found in the URL. Full URL was: ${href}`);
    }
    finishSignIn().catch((e) => setErrorDetail(`Unexpected exception: ${e?.message ?? String(e)}`));
  }, [navigate]);

  if (errorDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg text-left text-sm bg-card border border-destructive/30 rounded-md p-4">
          <p className="font-semibold text-destructive mb-2">Sign-in did not complete</p>
          <p className="text-muted-foreground break-words">{errorDetail}</p>
          <a href="/auth" className="inline-block mt-4 text-primary underline">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Signing you in…
    </div>
  );
}
