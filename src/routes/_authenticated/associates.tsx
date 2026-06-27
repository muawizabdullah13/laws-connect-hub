import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Pencil, Phone, Mail, UserPlus } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/associates")({ component: AssociatesPage });

type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null; notes: string | null };

function AssociatesPage() {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();

  const profiles = useQuery({
    queryKey: ["profiles-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone, notes").order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const roles = useQuery({
    queryKey: ["roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const roleOf = (id: string) => (roles.data ?? []).find(r => r.user_id === id)?.role ?? "associate";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Anyone who signs up appears here. The first signup is the admin; the rest are read-only associates.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {profiles.isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : (
            <ul className="divide-y">
              {(profiles.data ?? []).map(p => (
                <li key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{p.full_name ?? "Unnamed"}</span>
                      <Badge variant={roleOf(p.id) === "admin" ? "default" : "secondary"} className="text-[10px]">{roleOf(p.id)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                      {p.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                      {p.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                    </div>
                    {p.notes && <div className="text-xs mt-1 text-muted-foreground line-clamp-2">{p.notes}</div>}
                  </div>
                  {isAdmin && (
                    <EditProfileDialog profile={p} onSaved={() => qc.invalidateQueries({ queryKey: ["profiles-full"] })} />
                  )}
                </li>
              ))}
              {(profiles.data ?? []).length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  <UserPlus className="h-6 w-6 mx-auto mb-2" />
                  No one else has signed up yet.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditProfileDialog({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", notes: profile.notes ?? "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit associate</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
          <div><Label>WhatsApp phone (with country code)</Label><Input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="e.g. +92 300 1234567" /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} rows={3} /></div>
        </div>
        <DialogFooter><Button onClick={()=>save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
