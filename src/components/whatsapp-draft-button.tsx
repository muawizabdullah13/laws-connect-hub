import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { draftWhatsAppMessage } from "@/lib/ai.functions";
import { toast } from "sonner";

type Props = {
  phone: string | null | undefined;
  associateName?: string | null;
  caseTitle: string;
  caseNumber?: string | null;
  court?: string | null;
  nextHearingISO?: string | null;
  stage?: string | null;
};

function normalizePhone(raw: string) {
  return raw.replace(/[^\d]/g, "").replace(/^0+/, "");
}

export function WhatsAppDraftButton(p: Props) {
  const draft = useServerFn(draftWhatsAppMessage);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  async function start() {
    if (!p.phone) return toast.error("No WhatsApp number on file for this associate.");
    setOpen(true);
    setLoading(true);
    try {
      const r = await draft({
        data: {
          caseTitle: p.caseTitle,
          caseNumber: p.caseNumber ?? undefined,
          court: p.court ?? undefined,
          nextHearingISO: p.nextHearingISO ?? undefined,
          stage: p.stage ?? undefined,
          associateName: p.associateName ?? undefined,
        },
      });
      setText(r.message);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Failed to draft message";
      toast.error(m);
      setOpen(false);
    } finally { setLoading(false); }
  }

  function send() {
    if (!p.phone) return;
    const num = normalizePhone(p.phone);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={start} title="Draft WhatsApp update with AI" className="text-emerald-700 hover:text-emerald-800">
        <MessageCircle className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp draft {p.associateName ? `to ${p.associateName}` : ""}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 mr-2 animate-spin" />Drafting…</div>
          ) : (
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={10} />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={loading || !text.trim()}>Open WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
