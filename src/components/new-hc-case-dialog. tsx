import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { HC_CASE_TYPES, HC_BENCHES, formatHcCaseNumber, hcTypeByCode } from "@/lib/hc-case-types";

const emptyForm = () => ({
  hc_case_type: "", hc_case_no: "", hc_case_year: String(new Date().getFullYear()),
  bench: "Multan", title: "", next_hearing: "", client_name: "", arising_from: "", notes: "",
});

// "New case" form for High Court mode. A matter is identified by its type,
// number and year (e.g. W.P. 13485/2026), so those are required and checked
// for duplicates; the date of hearing is optional because new matters often
// don't have one yet.
export function NewHcCaseDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const create = useMutation({
    mutationFn: async () => {
      const year = Number(form.hc_case_year);
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.hc_case_type) throw new Error("Case type is required");
      if (!form.hc_case_no.trim()) throw new Error("Case number is required");
      if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new Error("Enter a valid 4-digit year");

      const { data: u } = await supabase.auth.getUser();
      const next_hearing_at = form.next_hearing ? new Date(`${form.next_hearing}T09:00:00`).toISOString() : null;
      const type = hcTypeByCode(form.hc_case_type);
      const payload = {
        title: form.title.trim(),
        court_level: "high",
        hc_case_type: form.hc_case_type,
        hc_case_no: form.hc_case_no.trim(),
        hc_case_year: year,
        bench: form.bench,
        court: `Lahore High Court, ${form.bench} Bench`,
        case_number: formatHcCaseNumber(form.hc_case_type, form.hc_case_no, year),
        case_type: type?.label ?? null,
        next_hearing_at,
        client_name: form.client_name.trim() || null,
        arising_from: form.arising_from.trim() || null,
        notes: form.notes.trim() || null,
        created_by: u.user?.id ?? null,
      };
      const { data, error } = await supabase.from("cases").insert(payload).select("id").single();
      if (error) {
        if (error.code === "23505") throw new Error("This case already exists (same type, number, year and bench).");
        throw error;
      }
      // Same convention as the district form: a dated case also appears on the cause list.
      if (data?.id && next_hearing_at) {
        await supabase.from("hearings").insert({ case_id: data.id, scheduled_at: next_hearing_at, court: payload.court });
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Case created");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["calendar-all-hearings"] });
      qc.invalidateQueries({ queryKey: ["dash"] });
      setOpen(false);
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm(f => ({ ...f, ...patch }));
  const ready = form.title.trim() && form.hc_case_type && form.hc_case_no.trim() && form.hc_case_year;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" />New HC case</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif">Add a High Court case</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-3">
            <Label>Case type *</Label>
            <Select value={form.hc_case_type} onValueChange={v => set({ hc_case_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {HC_CASE_TYPES.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Number *</Label>
            <Input value={form.hc_case_no} onChange={e => set({ hc_case_no: e.target.value })} placeholder="e.g. 13485" />
          </div>
          <div className="sm:col-span-1">
            <Label>Year *</Label>
            <Input inputMode="numeric" value={form.hc_case_year} onChange={e => set({ hc_case_year: e.target.value })} />
          </div>

          <div className="sm:col-span-6">
            <Label>Title (parties) *</Label>
            <Input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Wajahat Ali Qureshi vs FOP etc." />
          </div>

          <div className="sm:col-span-3">
            <Label>Bench</Label>
            <Select value={form.bench} onValueChange={v => set({ bench: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HC_BENCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Label>Next hearing (optional)</Label>
            <Input type="date" value={form.next_hearing} onChange={e => set({ next_hearing: e.target.value })} />
          </div>

          <div className="sm:col-span-3">
            <Label>Client name</Label>
            <Input value={form.client_name} onChange={e => set({ client_name: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <Label>Arising from (optional)</Label>
            <Input value={form.arising_from} onChange={e => set({ arising_from: e.target.value })} placeholder="Lower court case / earlier number" />
          </div>
          <div className="sm:col-span-6">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set({ notes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!ready || create.isPending} onClick={() => create.mutate()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
