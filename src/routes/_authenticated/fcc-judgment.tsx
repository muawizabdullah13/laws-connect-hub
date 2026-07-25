import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";

export const Route = createFileRoute("/_authenticated/fcc-judgments")({ component: FccJudgmentsPage });

type FccJudgment = {
  id: string;
  case_title: string;
  author_judge: string | null;
  upload_date: string;
  download_url: string;
  first_seen_at: string;
};

function FccJudgmentsPage() {
  const judgments = useQuery({
    queryKey: ["fcc-judgments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fcc_judgments")
        .select("id, case_title, author_judge, upload_date, download_url, first_seen_at")
        .order("upload_date", { ascending: false })
        .order("first_seen_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FccJudgment[];
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Checked automatically once a day against the Federal Constitutional Court's own judgments page.
          The Supreme Court doesn't allow automated checks, so those are still posted manually via the
          WhatsApp/share feature.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {judgments.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ul className="divide-y">
              {(judgments.data ?? []).map((j) => {
                const isNew = differenceInHours(new Date(), new Date(j.first_seen_at)) < 48;
                return (
                  <li key={j.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{j.case_title}</span>
                        {isNew && <Badge className="text-[10px]">New</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {j.author_judge && <>{j.author_judge} • </>}
                        Uploaded {format(new Date(j.upload_date), "d MMM yyyy")}
                        <span className="mx-1">•</span>
                        found {formatDistanceToNow(new Date(j.first_seen_at), { addSuffix: true })}
                      </div>
                    </div>
                    <a href={j.download_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Badge variant="outline" className="cursor-pointer hover:bg-accent inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> View
                      </Badge>
                    </a>
                  </li>
                );
              })}
              {(judgments.data ?? []).length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  <Gavel className="h-6 w-6 mx-auto mb-2" />
                  No judgments found yet.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
