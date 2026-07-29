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
import { Plus, Search, Upload, FileWarning } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-auth";
import { format } from "date-fns";
import { toast } from "sonner";
import Papa from "papaparse";

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
        {isAdmin && <ImportCasesDialog />}
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
                     {c.next_hearing_at ? format(new Date(c.next_hearing_at), "EEE, d MMM yyyy") : "No hearing set"}
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

type ParsedRow = {
  title: string;
  case_number: string | null;
  court: string | null;
  case_type: string | null;
  cms_url: string | null;
  stage: string | null;
  client_name: string | null;
};

// Matches common header spellings so the importer isn't locked to one
// exact spreadsheet layout — e.g. "Court / Judge", "Court", and "Judge"
// all map to the same field.
const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  title: ["casetitle", "title", "case"],
  case_number: ["casenumber", "caseno", "caseno.", "cmsnumber", "cmsno"],
  court: ["courtjudge", "court", "judge"],
  case_type: ["suitcategorytype", "casetype", "type", "category", "suitcategory"],
  cms_url: ["portallink", "cmslink", "cmsurl", "link", "url"],
  stage: ["statusstage", "stage", "status"],
  client_name: ["client", "clientname"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapCsvRows(data: Record<string, string>[]): { rows: ParsedRow[]; skipped: number; matchedFields: (keyof ParsedRow)[] } {
  if (data.length === 0) return { rows: [], skipped: 0, matchedFields: [] };
  const rawHeaders = Object.keys(data[0]);
  const headerMap: Partial<Record<keyof ParsedRow, string>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof ParsedRow, string[]][]) {
    const match = rawHeaders.find(h => aliases.includes(normalizeHeader(h)));
    if (match) headerMap[field] = match;
  }

  let skipped = 0;
  const rows: ParsedRow[] = [];
  for (const raw of data) {
    const title = headerMap.title ? raw[headerMap.title]?.trim() : "";
    if (!title) { skipped++; continue; }
    rows.push({
      title,
      case_number: headerMap.case_number ? (raw[headerMap.case_number]?.trim() || null) : null,
      court: headerMap.court ? (raw[headerMap.court]?.trim() || null) : null,
      case_type: headerMap.case_type ? (raw[headerMap.case_type]?.trim() || null) : null,
      cms_url: headerMap.cms_url ? (raw[headerMap.cms_url]?.trim() || null) : null,
      stage: headerMap.stage ? (raw[headerMap.stage]?.trim() || null) : null,
      client_name: headerMap.client_name ? (raw[headerMap.client_name]?.trim() || null) : null,
    });
  }
  return { rows, skipped, matchedFields: Object.keys(headerMap) as (keyof ParsedRow)[] };
}

function ImportCasesDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; skipped: number; matchedFields: (keyof ParsedRow)[] } | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setParsed(mapCsvRows(results.data)),
      error: (err) => toast.error(`Could not read file: ${err.message}`),
    });
  };

  const importRows = useMutation({
    mutationFn: async () => {
      if (!parsed || parsed.rows.length === 0) return;
      const { data: u } = await supabase.auth.getUser();
      const payload = parsed.rows.map(r => ({ ...r, created_by: u.user?.id ?? null }));
      const { error } = await supabase.from("cases").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Imported ${parsed?.rows.length} case${parsed?.rows.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["cases"] });
      setOpen(false);
      setParsed(null);
      setFileName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fieldLabels: Record<keyof ParsedRow, string> = {
    title: "Title", case_number: "Case number", court: "Court", case_type: "Case type",
    cms_url: "CMS link", stage: "Stage", client_name: "Client",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setParsed(null); setFileName(""); } }}>
      <DialogTrigger asChild><Button variant="outline"><Upload className="h-4 w-4 mr-1" />Import CSV</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import cases from CSV</DialogTitle></DialogHeader>

        {!parsed ? (
          <div>
            <Label>CSV file</Label>
            <Input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <p className="text-xs text-muted-foreground mt-2">
              Any columns you have are fine — the importer matches common headers like "Case Title", "Court",
              "Case Type", "Portal Link", and "Stage" automatically. Case number and CMS link can always be
              filled in later by editing a case, so it's fine if your sheet doesn't have them yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">{fileName}</span> — {parsed.rows.length} case{parsed.rows.length === 1 ? "" : "s"} ready to import
              {parsed.skipped > 0 && <span className="text-muted-foreground"> ({parsed.skipped} row{parsed.skipped === 1 ? "" : "s"} skipped, no title)</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              Matched columns: {parsed.matchedFields.length > 0 ? parsed.matchedFields.map(f => fieldLabels[f]).join(", ") : "none — check your file has a title column"}
            </div>
            {parsed.rows.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-destructive"><FileWarning className="h-4 w-4" />No valid rows found (need at least a title column).</div>
            ) : (
              <div className="border rounded-md max-h-56 overflow-y-auto">
                <ul className="divide-y text-sm">
                  {parsed.rows.slice(0, 8).map((r, i) => (
                    <li key={i} className="p-2 truncate">{r.title} {r.court && <span className="text-muted-foreground">• {r.court}</span>}</li>
                  ))}
                  {parsed.rows.length > 8 && <li className="p-2 text-xs text-muted-foreground">+ {parsed.rows.length - 8} more</li>}
                </ul>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setFileName(""); }}>Choose a different file</Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => importRows.mutate()} disabled={!parsed || parsed.rows.length === 0 || importRows.isPending}>
            Import {parsed && parsed.rows.length > 0 ? parsed.rows.length : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.court.trim()) throw new Error("Court / Forum is required");
      if (!form.next_hearing_at) throw new Error("Next hearing date is required");
      const { data: u } = await supabase.auth.getUser();
      const next_hearing_at = new Date(`${form.next_hearing_at}T09:00:00`).toISOString();
      const payload = { ...form, case_number: form.case_number || null, next_hearing_at, cms_url: form.cms_url || null, created_by: u.user?.id ?? null };
      const { error, data } = await supabase.from("cases").insert(payload).select("id").single();
      if (error) throw error;

      if (data?.id) {
        await supabase.from("hearings").insert({ case_id: data.id, scheduled_at: next_hearing_at, court: form.court || null });
      }
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
          <Field label="Title *"><Input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} placeholder="e.g. A vs B" /></Field>
          <Field label="Court / Forum *"><Input value={form.court} onChange={e=>setForm({...form, court: e.target.value})} /></Field>
          <Field label="Next hearing *"><Input type="date" value={form.next_hearing_at} onChange={e=>setForm({...form, next_hearing_at: e.target.value})} /></Field>
          <Field label="Case number (optional)"><Input value={form.case_number} onChange={e=>setForm({...form, case_number: e.target.value})} /></Field>          <Field label="Client name"><Input value={form.client_name} onChange={e=>setForm({...form, client_name: e.target.value})} /></Field>
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
