import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, CheckSquare, Gavel } from "lucide-react";
import { format, isToday, startOfDay, endOfDay } from "date-fns";
import { EnableNotificationsBanner } from "@/components/enable-notifications-banner";
import { useAuth } from "@/hooks/use-auth";
import { useCourtLevel } from "@/hooks/use-court-level";
import { CourtLevelSwitch } from "@/components/court-level-switch";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const { level } = useCourtLevel();

  const todayHearings = useQuery({
    queryKey: ["dash", "today-hearings", level],
    queryFn: async () => {
      const start = startOfDay(new Date()).toISOString();
      const end = endOfDay(new Date()).toISOString();
      const { data, error } = await supabase
        .from("hearings")
        .select("id, scheduled_at, court, purpose, case_id, cases!inner(title, case_number, court_level)")
        .eq("cases.court_level", level)
        .gte("scheduled_at", start).lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Cases assigned specifically to the signed-in associate. If they have no
  // assignments at all (e.g. an admin, or an associate not yet assigned to
  // anything), fall back to showing the firm's most recently active cases
  // with a link through to the full case list.
  const myAssignments = useQuery({
    queryKey: ["dash", "my-assignments", user?.id, level],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("case_assignments")
        .select("cases!inner(id, title, case_number, status, next_hearing_at, court_level)")
        .eq("user_id", user.id)
        .eq("cases.court_level", level);
      if (error) throw error;
      return (data ?? []).map(r => r.cases).filter(Boolean) as { id: string; title: string; case_number: string | null; status: string; next_hearing_at: string | null }[];
    },
  });

  const fallbackCases = useQuery({
    queryKey: ["dash", "fallback-cases", level],
    enabled: !!user && myAssignments.isSuccess && myAssignments.data.length === 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, title, case_number, status, next_hearing_at")
        .eq("status", "active")
        .eq("court_level", level)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ["dash", "counts", level],
    queryFn: async () => {
      const [c, t] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("status", "active").eq("court_level", level),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
      ]);
      return { activeCases: c.count ?? 0, openTasks: t.count ?? 0 };
    },
  });

  const newFccToday = useQuery({
    queryKey: ["dash", "new-fcc-today"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("fcc_judgments")
        .select("id", { count: "exact", head: true })
        .gte("first_seen_at", startOfDay(new Date()).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  const todayList = (todayHearings.data ?? []).filter(h => isToday(new Date(h.scheduled_at)));
  const isPersonalized = (myAssignments.data ?? []).length > 0;
  const myCases = isPersonalized ? myAssignments.data! : (fallbackCases.data ?? []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <EnableNotificationsBanner />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">{level === "high" ? "High Court" : "District Court"}</h1>
        <CourtLevelSwitch />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Today's cause list</CardTitle></CardHeader>
        <CardContent>
          {todayList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hearings scheduled for today.</p>
          ) : (
            <ul className="divide-y">
              {todayList.map(h => (
                <li key={h.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to="/cases/$caseId" params={{ caseId: h.case_id }} className="font-medium hover:underline">
                      {(h.cases as { title: string } | null)?.title ?? "Case"}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      {(h.cases as { case_number: string } | null)?.case_number} • {h.court ?? "—"} • {h.purpose ?? ""}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-primary tabular-nums">{format(new Date(h.scheduled_at), "d MMM")}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">{isPersonalized ? "My cases" : "Cases"}</CardTitle>
          </CardHeader>
          <CardContent>
            {myCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases yet.</p>
            ) : (
              <ul className="divide-y">
                {myCases.map(c => (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <Link to="/cases/$caseId" params={{ caseId: c.id }} className="min-w-0 truncate hover:underline">
                      {c.title}
                    </Link>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {c.next_hearing_at ? format(new Date(c.next_hearing_at), "d MMM") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/cases" className="mt-3 inline-block text-xs text-primary hover:underline">
              {isPersonalized ? "View all cases →" : "Browse all cases →"}
            </Link>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <QuickTile to="/tasks" icon={CheckSquare} label="Tasks" value={counts.data?.openTasks ?? "—"} />
          <QuickTile to="/fcc-judgments" icon={Gavel} label="FCC judgments" value={newFccToday.data ?? "—"} sub="new today" />
          <QuickTile to="/cases" icon={Briefcase} label="Active cases" value={counts.data?.activeCases ?? "—"} />
        </div>
      </div>
    </div>
  );
}

function QuickTile({ to, icon: Icon, label, value, sub }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Link to={to}>
      <Card className="h-full hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1.5 aspect-square">
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-4 w-4" /></div>
          <div className="text-xl font-serif leading-none">{value}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}
