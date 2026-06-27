import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

function CalendarPage() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const hearings = useQuery({
    queryKey: ["calendar", format(month, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("id, scheduled_at, court, purpose, case_id, cases(title, case_number)")
        .gte("scheduled_at", rangeStart.toISOString())
        .lte("scheduled_at", rangeEnd.toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-xl">{format(month, "MMMM yyyy")}</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={()=>setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={()=>setMonth(startOfMonth(new Date()))}>Today</Button>
            <Button variant="ghost" size="icon" onClick={()=>setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px text-center text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border">
            {days.map(d => {
              const dayHearings = (hearings.data ?? []).filter(h => isSameDay(new Date(h.scheduled_at), d));
              const inMonth = isSameMonth(d, month);
              return (
                <div key={d.toISOString()} className={"bg-card min-h-[100px] p-1.5 " + (inMonth ? "" : "opacity-40")}>
                  <div className={"text-xs " + (isSameDay(d, new Date()) ? "font-bold text-primary" : "text-muted-foreground")}>{format(d, "d")}</div>
                  <ul className="space-y-0.5 mt-1">
                    {dayHearings.slice(0,3).map(h => (
                      <li key={h.id}>
                        <Link to="/cases/$caseId" params={{ caseId: h.case_id }} className="block text-[10px] leading-tight px-1 py-0.5 rounded bg-primary/10 text-primary truncate hover:bg-primary/20">
                          {format(new Date(h.scheduled_at), "HH:mm")} {(h.cases as { title: string } | null)?.title}
                        </Link>
                      </li>
                    ))}
                    {dayHearings.length > 3 && <li className="text-[10px] text-muted-foreground">+{dayHearings.length-3} more</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
