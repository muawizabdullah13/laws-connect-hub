import { useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

export function EnableNotificationsBanner() {
  const { status, isSupported, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (!isSupported || status === "subscribed" || dismissed) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 text-primary shrink-0" />
          <span>Turn on notifications for new judgments and hearing reminders.</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={subscribe}>Enable</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
