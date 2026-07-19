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
      const hasCode = href.includes("code=");

      if (!hasCode) {
        setErrorDetail(`No "code" parameter found in the URL Google/Supabase redirected to. Full URL was: ${href}`);
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(href);

      if (error || !data.session) {
        setErrorDetail(error?.message ?? "exchangeCodeForSession returned no session and no error.");
        return;
      }

      navigate({ to: "/dashboard", replace: true });
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
