import { useCourtLevel } from "@/hooks/use-court-level";
import { Landmark, Building2 } from "lucide-react";

export function CourtLevelSwitch({ compact = false }: { compact?: boolean }) {
  const { level, setLevel } = useCourtLevel();
  const opts = [
    { value: "district" as const, label: "District Court", icon: Building2 },
    { value: "high" as const, label: "High Court", icon: Landmark },
  ];
  return (
    <div role="group" aria-label="Court" className="inline-flex rounded-md border border-border overflow-hidden text-sm">
      {opts.map(o => {
        const active = level === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLevel(o.value)}
            aria-pressed={active}
            className={
              "flex items-center gap-1.5 px-3 py-1.5 transition-colors " +
              (compact ? "text-xs px-2 py-1 " : "") +
              (active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")
            }
          >
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
