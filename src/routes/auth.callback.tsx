import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function finishSignIn() {
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error || !data.session) {
        toast.error(error?.message ?? "Google sign-in failed");
        navigate({ to: "/auth", replace: true });
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    }
    finishSignIn();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Signing you in…
    </div>
  );
}
