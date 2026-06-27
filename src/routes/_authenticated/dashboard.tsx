import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, CheckSquare, CalendarClock, AlertTriangle } from "lucide-react";
import { format, isToday, isPast, startOfDay, endOfDay, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const today = useQuery({
    queryKey: ["dash", "today-hearings"],
    queryFn: async () => {
      const start = startOfDay(new Date()).toISOString();
      const end = endOfDay(addDays(new Date(), 7)).toISOString();
      const { data, error } = await supabase
        .from("hearings")
        .select("id, scheduled_at, court, purpose, case_id, cases(title, case_number)")
        .gte("scheduled_at", start).lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const overdue = useQuery({
    queryKey: ["dash", "overdue-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("id, title, due_at, priority, status, case_id, cases(title)")
        .neq("status", "done").not("due_at", "is", null)
        .lte("due_at", new Date().toISOString())
        .order("due_at", { ascending: true }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ["dash", "counts"],
    queryFn: async () => {
      const [c, t] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
      ]);
      return { activeCases: c.count ?? 0, openTasks: t.count ?? 0 };
    },
  });

  const todayList = (today.data ?? []).filter(h => isToday(new Date(h.scheduled_at)));
  const upcoming = (today.data ?? []).filter(h => !isToday(new Date(h.scheduled_at)));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={Briefcase} label="Active cases" value={counts.data?.activeCases ?? "—"} />
        <Stat icon={CalendarClock} label="Hearings today" value={todayList.length} />
        <Stat icon={CheckSquare} label="Open tasks" value={counts.data?.openTasks ?? "—"} />
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
                  <div className="text-sm font-medium text-primary tabular-nums">{format(new Date(h.scheduled_at), "h:mm a")}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Upcoming this week</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing scheduled.</p> : (
              <ul className="divide-y">
                {upcoming.slice(0,6).map(h => (
                  <li key={h.id} className="py-2 flex items-center justify-between text-sm">
                    <Link to="/cases/$caseId" params={{ caseId: h.case_id }} className="truncate hover:underline">
                      {(h.cases as { title: string } | null)?.title}
                    </Link>
                    <span className="text-muted-foreground tabular-nums">{format(new Date(h.scheduled_at), "EEE d MMM, h:mm a")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-lg flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Overdue tasks</CardTitle></CardHeader>
          <CardContent>
            {(overdue.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">All caught up.</p> : (
              <ul className="divide-y">
                {(overdue.data ?? []).map(t => (
                  <li key={t.id} className="py-2 flex items-center justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <div className="truncate">{t.title}</div>
                      {(t.cases as { title: string } | null) && <div className="text-xs text-muted-foreground truncate">{(t.cases as { title: string }).title}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={t.priority === "high" ? "destructive" : "secondary"} className="text-[10px]">{t.priority}</Badge>
                      {t.due_at && <span className={"text-xs " + (isPast(new Date(t.due_at)) ? "text-destructive" : "text-muted-foreground")}>{format(new Date(t.due_at), "d MMM")}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{className?: string}>; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-serif">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
