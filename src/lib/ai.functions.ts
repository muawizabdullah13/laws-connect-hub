import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({
  caseTitle: z.string().min(1),
  caseNumber: z.string().optional(),
  court: z.string().optional(),
  nextHearingISO: z.string().optional(),
  stage: z.string().optional(),
  associateName: z.string().optional(),
});

export const draftWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { getAiGateway } = await import("./ai-gateway.server");
    const gateway = getAiGateway();
    const hearing = data.nextHearingISO
      ? new Date(data.nextHearingISO).toLocaleString("en-PK", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "to be confirmed";

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt: `Draft a short, polite WhatsApp message in clear English (Pakistan legal context) from an advocate to an associate about an upcoming hearing.

Associate: ${data.associateName ?? "Associate"}
Case: ${data.caseTitle}${data.caseNumber ? ` (No. ${data.caseNumber})` : ""}
Court: ${data.court ?? "—"}
Next hearing: ${hearing}
Stage / what to prepare: ${data.stage ?? "—"}

Rules:
- Greet briefly (Assalam-o-Alaikum).
- 4–6 short lines, no markdown, no emojis except a single 📍 before the court line if helpful.
- End with "— ZLC". Do not invent facts. If a field is "—", omit that line.
- Plain text only, ready to paste into WhatsApp.`,
    });
    return { message: text.trim() };
  });
