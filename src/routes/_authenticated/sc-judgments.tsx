import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Gavel, ExternalLink, Plus, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sc-judgments")({ component: ScJudgmentsPage });

const SC_SITE_URL = "https://www.supremecourt.gov.pk/latest-judgements/";

type ScJudgment = {
  id: string;
  title: string;
  citation: string | null;
  url: string;
  created_at: string;
};

function ScJudgmentsPage() {
  // If this page was opened via the phone's Share sheet (after finding a
  // judgment on the SC site), the shared link/title arrive as URL params —
  // pick them up and open the post form pre-filled.
  const [prefill, setPrefill] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("shared_url") || "";
    const sharedTitle = params.get("shared_title") || "";
    const sharedText = params.get("shared_text") || "";
    const url = sharedUrl || (sharedText.match(/https?:\/\/\S+/)?.[0] ?? "");
    if (url) {
      setPrefill({ title: sharedTitle, url });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const judgments = useQuery({
    queryKey: ["sc-judgments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sc_judgments")
        .select("id, title, citation, url, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScJudgment[];
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <a href={SC_SITE_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" />Open Supreme Court site</Button>
        </a>
        <PostJudgmentDialog prefill={prefill} onConsumedPrefill={() => setPrefill(null)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {judgments.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ul className="divide-y">
              {(judgments.data ?? []).map(j => (
                <li key={j.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {j.citation && <>{j.citation} • </>}
                      posted {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <a href={j.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Badge variant="outline" className="cursor-pointer hover:bg-accent inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> View
                    </Badge>
                  </a>
                </li>
              ))}
              {(judgments.data ?? []).length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  <Gavel className="h-6 w-6 mx-auto mb-2" />
                  No Supreme Court judgments posted yet.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PostJudgmentDialog({ prefill, onConsumedPrefill }: { prefill: { title: string; url: string } | null; onConsumedPrefill: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", citation: "", url: "" });

  useEffect(() => {
    if (prefill) {
      setForm({ title: prefill.title, citation: "", url: prefill.url });
      setOpen(true);
      onConsumedPrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const post = useMutation({
    mutationFn: async () => {
      if (!form.url.trim()) throw new Error("A link is required");
      // Title isn't required from the person posting — SC's site blocks
      // automated fetching, so we can't pull a real title from the link
      // itself; fall back to the citation, or a dated placeholder, so
      // sharing straight from the browser never gets blocked on this.
      const title = form.title.trim() || form.citation.trim() || `Supreme Court judgment — ${format(new Date(), "d MMM yyyy")}`;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("sc_judgments").insert({
        title,
        citation: form.citation.trim() || null,
        url: form.url.trim(),
        posted_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Posted — everyone's being notified now");
      qc.invalidateQueries({ queryKey: ["sc-judgments"] });
      setOpen(false);
      setForm({ title: "", citation: "", url: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Post judgment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Post a Supreme Court judgment</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          <Share2 className="h-3 w-3 inline mr-1" />
          Tip: on the SC site, use your phone's Share button and pick ZLC Digital — the link fills in automatically.
        </p>
        <div className="space-y-3">
          <div><Label>Case title (optional)</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Muhammad Ali v. State — leave blank if you're in a hurry" /></div>
          <div><Label>Citation (optional)</Label><Input value={form.citation} onChange={e => setForm({ ...form, citation: e.target.value })} placeholder="e.g. PLD 2026 SC 123" /></div>
          <div><Label>Link</Label><Input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="Paste the judgment link from the SC site" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => post.mutate()} disabled={post.isPending}>Post &amp; notify everyone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
