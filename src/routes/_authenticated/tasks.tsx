import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useIsAdmin } from "@/hooks/use-auth";
import { format, isPast } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

type Filter = "all" | "open" | "done" | "overdue";

function TasksPage() {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");

  const tasks = useQuery({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      let q = supabase.from("tasks").select("id, title, description, due_at, priority, status, case_id, assigned_to, cases(title)").order("due_at", { ascending: true, nullsFirst: false });
      if (filter === "open") q = q.neq("status", "done");
      if (filter === "done") q = q.eq("status", "done");
      if (filter === "overdue") q = q.neq("status", "done").lte("due_at", new Date().toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ status: done ? "done" : "pending" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && <NewTaskDialog onSaved={() => qc.invalidateQueries({ queryKey: ["tasks"] })} />}
      </div>

      <Card>
        <CardContent className="p-0">
          {tasks.isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> :
           (tasks.data ?? []).length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nothing here.</div> : (
            <ul className="divide-y">
              {(tasks.data ?? []).map(t => {
                const overdue = t.due_at && isPast(new Date(t.due_at)) && t.status !== "done";
                return (
                  <li key={t.id} className="p-3 flex items-center gap-3">
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={(v) => isAdmin && toggle.mutate({ id: t.id, done: !!v })}
                      disabled={!isAdmin}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={"truncate " + (t.status === "done" ? "line-through text-muted-foreground" : "")}>{t.title}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        {t.due_at && <span className={overdue ? "text-destructive" : ""}>{format(new Date(t.due_at), "EEE d MMM, h:mm a")}</span>}
                        {t.case_id && (t.cases as { title: string } | null) && (
                          <Link to="/cases/$caseId" params={{ caseId: t.case_id }} className="hover:underline">
                            • {(t.cases as { title: string }).title}
                          </Link>
                        )}
                      </div>
                    </div>
                    <Badge variant={t.priority === "high" ? "destructive" : t.priority === "low" ? "outline" : "secondary"} className="text-[10px]">{t.priority}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewTaskDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_at: "", priority: "medium", case_id: "", assigned_to: "" });

  const cases = useQuery({
    queryKey: ["cases-min"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id, title").order("title");
      return data ?? [];
    },
  });
  const profiles = useQuery({
    queryKey: ["profiles-min"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        title: form.title, description: form.description || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        priority: form.priority as "low"|"medium"|"high",
        case_id: form.case_id || null,
        assigned_to: form.assigned_to || null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task added"); setOpen(false); setForm({ title: "", description: "", due_at: "", priority: "medium", case_id: "", assigned_to: "" }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New task</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">New task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Due</Label><Input type="datetime-local" value={form.due_at} onChange={e=>setForm({...form, due_at: e.target.value})} /></div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={v=>setForm({...form, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Attach to case (optional)</Label>
            <Select value={form.case_id} onValueChange={v=>setForm({...form, case_id: v})}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {(cases.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Assign to (optional)</Label>
            <Select value={form.assigned_to} onValueChange={v=>setForm({...form, assigned_to: v})}>
              <SelectTrigger><SelectValue placeholder="Me" /></SelectTrigger>
              <SelectContent>
                {(profiles.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button disabled={!form.title || save.isPending} onClick={()=>save.mutate()}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
