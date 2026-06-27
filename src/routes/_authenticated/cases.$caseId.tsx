import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, MessageCircle as _MC } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-auth";
import { format } from "date-fns";
import { toast } from "sonner";
import { WhatsAppDraftButton } from "@/components/whatsapp-draft-button";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({ component: CaseDetail });

function CaseDetail() {
  const { caseId } = Route.useParams();
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const caseQ = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).single();
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone");
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignments = useQuery({
    queryKey: ["case-assignments", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("case_assignments").select("user_id").eq("case_id", caseId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const hearings = useQuery({
    queryKey: ["hearings", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hearings").select("*").eq("case_id", caseId).order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasks = useQuery({
    queryKey: ["case-tasks", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("case_id", caseId).order("due_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignedProfiles = (profiles.data ?? []).filter(p => (assignments.data ?? []).some(a => a.user_id === p.id));

  const updateCase = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("cases").update(patch).eq("id", caseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["cases"] }); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("case_assignments").insert({ case_id: caseId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-assignments", caseId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("case_assignments").delete().eq("case_id", caseId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-assignments", caseId] }),
  });

  if (caseQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!caseQ.data) return <p className="text-sm text-muted-foreground">Case not found.</p>;
  const c = caseQ.data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/cases"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Cases</Button></Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-serif text-2xl">{c.title}</CardTitle>
            <div className="text-sm text-muted-foreground mt-1">Case No. {c.case_number} {c.court && `• ${c.court}`}</div>
          </div>
          {isAdmin && (
            <Select value={c.status} onValueChange={v => updateCase.mutate({ status: v })}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <Info label="Client">{c.client_name ?? "—"} {c.client_phone && <span className="text-muted-foreground">• {c.client_phone}</span>}</Info>
          <Info label="Opposing party">{c.opposing_party ?? "—"}</Info>
          <Info label="Stage">{c.stage ?? "—"}</Info>
          <Info label="Next hearing">{c.next_hearing_at ? format(new Date(c.next_hearing_at), "EEE d MMM yyyy, h:mm a") : "Not scheduled"}</Info>
          {c.notes && <div className="sm:col-span-2"><Info label="Notes"><span className="whitespace-pre-wrap">{c.notes}</span></Info></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-lg">Assigned associates</CardTitle>
          {isAdmin && (
            <AssignDialog
              all={(profiles.data ?? [])}
              assignedIds={(assignments.data ?? []).map(a => a.user_id)}
              onAssign={id => assign.mutate(id)}
            />
          )}
        </CardHeader>
        <CardContent>
          {assignedProfiles.length === 0 ? <p className="text-sm text-muted-foreground">No associates assigned.</p> : (
            <ul className="divide-y">
              {assignedProfiles.map(p => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.full_name ?? p.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.phone ?? "no phone"}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <WhatsAppDraftButton
                      phone={p.phone} associateName={p.full_name ?? p.email}
                      caseTitle={c.title} caseNumber={c.case_number}
                      court={c.court} nextHearingISO={c.next_hearing_at} stage={c.stage}
                    />
                    {isAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => unassign.mutate(p.id)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Hearings</CardTitle>
            {isAdmin && <AddHearingDialog caseId={caseId} onSaved={() => { hearings.refetch(); qc.invalidateQueries({ queryKey: ["case", caseId] }); }} />}
          </CardHeader>
          <CardContent>
            {(hearings.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No hearings recorded.</p> : (
              <ul className="divide-y">
                {(hearings.data ?? []).map(h => (
                  <li key={h.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{format(new Date(h.scheduled_at), "EEE d MMM, h:mm a")}</span>
                      {h.court && <span className="text-xs text-muted-foreground">{h.court}</span>}
                    </div>
                    {h.purpose && <div className="text-xs text-muted-foreground mt-0.5">{h.purpose}</div>}
                    {h.outcome && <div className="text-xs mt-1">Outcome: {h.outcome}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Tasks on this case</CardTitle>
            {isAdmin && <AddTaskDialog caseId={caseId} profiles={profiles.data ?? []} onSaved={() => tasks.refetch()} />}
          </CardHeader>
          <CardContent>
            {(tasks.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No tasks.</p> : (
              <ul className="divide-y">
                {(tasks.data ?? []).map(t => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.due_at ? format(new Date(t.due_at), "d MMM h:mm a") : ""}</div>
                    </div>
                    <Badge variant={t.status === "done" ? "outline" : "secondary"} className="text-[10px]">{t.status}</Badge>
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

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5">{children}</div></div>;
}

function AssignDialog({ all, assignedIds, onAssign }: { all: Array<{id:string; full_name:string|null; email:string|null}>; assignedIds: string[]; onAssign: (id:string)=>void }) {
  const [open, setOpen] = useState(false);
  const available = all.filter(p => !assignedIds.includes(p.id));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Assign</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign associate</DialogTitle></DialogHeader>
        {available.length === 0 ? <p className="text-sm text-muted-foreground">No more associates available.</p> : (
          <ul className="divide-y max-h-80 overflow-auto">
            {available.map(p => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <span>{p.full_name ?? p.email}</span>
                <Button size="sm" onClick={() => { onAssign(p.id); setOpen(false); }}>Assign</Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddHearingDialog({ caseId, onSaved }: { caseId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ scheduled_at: "", court: "", purpose: "", outcome: "" });
  const save = useMutation({
    mutationFn: async () => {
      if (!form.scheduled_at) throw new Error("Pick a date and time");
      const { error } = await supabase.from("hearings").insert({ case_id: caseId, scheduled_at: new Date(form.scheduled_at).toISOString(), court: form.court || null, purpose: form.purpose || null, outcome: form.outcome || null });
      if (error) throw error;
      // also update next_hearing on case if future
      if (new Date(form.scheduled_at) > new Date()) {
        await supabase.from("cases").update({ next_hearing_at: new Date(form.scheduled_at).toISOString() }).eq("id", caseId);
      }
    },
    onSuccess: () => { toast.success("Hearing added"); setOpen(false); setForm({ scheduled_at: "", court: "", purpose: "", outcome: "" }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Hearing</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add hearing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Date & time</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm({...form, scheduled_at: e.target.value})} /></div>
          <div><Label>Court</Label><Input value={form.court} onChange={e=>setForm({...form, court: e.target.value})} /></div>
          <div><Label>Purpose</Label><Input value={form.purpose} onChange={e=>setForm({...form, purpose: e.target.value})} placeholder="e.g. Cross-examination" /></div>
          <div><Label>Outcome (if past)</Label><Textarea value={form.outcome} onChange={e=>setForm({...form, outcome: e.target.value})} rows={2} /></div>
        </div>
        <DialogFooter><Button onClick={()=>save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTaskDialog({ caseId, profiles, onSaved }: { caseId: string; profiles: Array<{id:string; full_name:string|null; email:string|null}>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", due_at: "", priority: "medium", assigned_to: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        title: form.title, case_id: caseId,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        priority: form.priority as "low"|"medium"|"high",
        assigned_to: form.assigned_to || null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task added"); setOpen(false); setForm({ title: "", due_at: "", priority: "medium", assigned_to: "" }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Task</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Due</Label><Input type="datetime-local" value={form.due_at} onChange={e=>setForm({...form, due_at: e.target.value})} /></div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={v=>setForm({...form, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Assign to (optional)</Label>
            <Select value={form.assigned_to} onValueChange={v=>setForm({...form, assigned_to: v})}>
              <SelectTrigger><SelectValue placeholder="Nobody" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={()=>save.mutate()} disabled={!form.title || save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
