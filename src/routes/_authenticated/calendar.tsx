import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { addWeeks, eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek, getWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type HearingWithCase = {
  id: string;
  scheduled_at: string;
  court: string | null;
  purpose: string | null;
  case_id: string;
  cases: { title: string; case_number: string | null; court: string | null } | null;
};

function CalendarPage() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetching all hearings (a small dataset for a solo/small chambers practice)
  // rather than just this week's, so "last date" / "next date" can be worked
  // out for any case regardless of which week is currently on screen.
  const hearings = useQuery({
    queryKey: ["calendar-all-hearings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("id, scheduled_at, court, purpose, case_id, cases(title, case_number, court)")
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as unknown as HearingWithCase[];
    },
  });

  const all = hearings.data ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-center">
            <CardTitle className="font-serif text-lg">Week {getWeek(weekStart, { weekStartsOn: 1 })}</CardTitle>
            <div className="text-xs text-muted-foreground">{format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </CardHeader>
      </Card>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This week</Button>
      </div>

      <div className="space-y-2">
        {days.map(d => {
          const dayHearings = all.filter(h => isSameDay(new Date(h.scheduled_at), d));
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => setSelectedDay(d)}
              className={`w-full text-left rounded-md border p-3 transition-colors hover:bg-accent ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{format(d, "EEEE")}</span>
                  <span className="text-sm text-muted-foreground ml-2">{format(d, "d MMM")}</span>
                </div>
                {dayHearings.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                    {dayHearings.length} case{dayHearings.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {dayHearings.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {dayHearings.slice(0, 3).map(h => (
                    <li key={h.id} className="text-xs text-muted-foreground truncate">{h.cases?.title}</li>
                  ))}
                  {dayHearings.length > 3 && <li className="text-xs text-muted-foreground">+{dayHearings.length - 3} more</li>}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      <DayDetailDialog day={selectedDay} onClose={() => setSelectedDay(null)} allHearings={all} />
    </div>
  );
}

function DayDetailDialog({ day, onClose, allHearings }: { day: Date | null; onClose: () => void; allHearings: HearingWithCase[] }) {
  const dayHearings = day ? allHearings.filter(h => isSameDay(new Date(h.scheduled_at), day)) : [];

  return (
    <Dialog open={!!day} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        {day && (
          <>
            <DialogHeader><DialogTitle>{format(day, "EEEE, d MMMM yyyy")}</DialogTitle></DialogHeader>
            {dayHearings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases listed this day.</p>
            ) : (
              <ul className="divide-y">
                {dayHearings.map(h => {
                  const caseHearings = allHearings
                    .filter(x => x.case_id === h.case_id)
                    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                  const idx = caseHearings.findIndex(x => x.id === h.id);
                  const lastDate = idx > 0 ? caseHearings[idx - 1] : null;
                  const nextDate = idx < caseHearings.length - 1 ? caseHearings[idx + 1] : null;
                  return (
                    <li key={h.id} className="py-3">
                      <Link to="/cases/$caseId" params={{ caseId: h.case_id }} className="font-medium hover:underline">
                        {h.cases?.title}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{h.court || h.cases?.court || "Court not set"}</div>
                      {h.purpose && <div className="text-sm mt-1">Proceeding: {h.purpose}</div>}
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1.5">
                        <span>Last date: {lastDate ? format(new Date(lastDate.scheduled_at), "d MMM yyyy") : "—"}</span>
                        <span>Next date: {nextDate ? format(new Date(nextDate.scheduled_at), "d MMM yyyy") : "—"}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
