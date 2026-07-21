import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-auth";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cases")({ component: CasesPage });

type CaseStatus = "active" | "on_hold" | "closed";

function CasesPage() {
  const { data: isAdmin } = useIsAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CaseStatus | "all">("all");

  const cases = useQuery({
    queryKey: ["cases", { q, status }],
    queryFn: async () => {
      let query = supabase.from("cases").select("*").order("next_hearing_at", { ascending: true, nullsFirst: false });
      if (status !== "all") query = query.eq("status", status);
      if (q) query = query.or(`title.ilike.%${q}%,case_number.ilike.%${q}%,client_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by title, case no, or client…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={v => setStatus(v as CaseStatus | "all")}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && <NewCaseDialog />}
      </div>

      <Card>
        <CardContent className="p-0">
          {cases.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (cases.data ?? []).length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No cases yet. {isAdmin && "Click 'New case' to add your first."}
            </div>
          ) : (
            <ul className="divide-y">
              {(cases.data ?? []).map(c => (
                <li key={c.id} className="p-4 hover:bg-accent/40">
                  <Link to="/cases/$caseId" params={{ caseId: c.id }} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.title}</span>
                        <StatusBadge s={c.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {c.case_number} {c.court ? `• ${c.court}` : ""} {c.client_name ? `• ${c.client_name}` : ""}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums text-primary">
                      {c.next_hearing_at ? format(new Date(c.next_hearing_at), "EEE, d MMM • h:mm a") : "No hearing set"}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ s }: { s: CaseStatus }) {
  const map = {
    active: { label: "Active", v: "default" as const },
    on_hold: { label: "On hold", v: "secondary" as const },
    closed: { label: "Closed", v: "outline" as const },
  };
  return <Badge variant={map[s].v} className="text-[10px]">{map[s].label}</Badge>;
}

function NewCaseDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    case_number: "", title: "", court: "", client_name: "", client_phone: "",
    opposing_party: "", stage: "", notes: "", next_hearing_at: "", cms_url: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = { ...form, next_hearing_at: form.next_hearing_at || null, cms_url: form.cms_url || null, created_by: u.user?.id ?? null };
      const { error, data } = await supabase.from("cases").insert(payload).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Case created");
      qc.invalidateQueries({ queryKey: ["cases"] });
      setOpen(false);
      setForm({ case_number: "", title: "", court: "", client_name: "", client_phone: "", opposing_party: "", stage: "", notes: "", next_hearing_at: "", cms_url: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" />New case</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif">Add a case</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Case number"><Input value={form.case_number} onChange={e=>setForm({...form, case_number: e.target.value})} /></Field>
          <Field label="Title"><Input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} placeholder="e.g. A vs B" /></Field>
          <Field label="Court / Forum"><Input value={form.court} onChange={e=>setForm({...form, court: e.target.value})} /></Field>
          <Field label="Next hearing"><Input type="datetime-local" value={form.next_hearing_at} onChange={e=>setForm({...form, next_hearing_at: e.target.value})} /></Field>
          <Field label="Client name"><Input value={form.client_name} onChange={e=>setForm({...form, client_name: e.target.value})} /></Field>
          <Field label="Client phone"><Input value={form.client_phone} onChange={e=>setForm({...form, client_phone: e.target.value})} /></Field>
          <Field label="Opposing party"><Input value={form.opposing_party} onChange={e=>setForm({...form, opposing_party: e.target.value})} /></Field>
          <Field label="Stage"><Input value={form.stage} onChange={e=>setForm({...form, stage: e.target.value})} placeholder="e.g. Evidence, Arguments" /></Field>
          <div className="sm:col-span-2">
            <Field label="CMS case link (optional)">
              <Input
                type="url"
                value={form.cms_url}
                onChange={e=>setForm({...form, cms_url: e.target.value})}
                placeholder="Paste the DSJ Punjab / court CMS case detail URL"
              />
            </Field>
          </div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
          <Button disabled={!form.title || !form.case_number || create.isPending} onClick={()=>create.mutate()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}
