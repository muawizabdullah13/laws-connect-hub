import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

// Plain-language: this hook handles the one-time "turn on notifications"
// action. It asks the browser for permission, registers the background
// service worker, gets a unique subscription from the browser, and saves
// that subscription in Supabase so our server-side jobs know where to send
// alerts for this specific device.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"unsupported" | "checking" | "subscribed" | "unsubscribed">("checking");

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setStatus("unsupported");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub ? "subscribed" : "unsubscribed");
  }, [isSupported]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      toast.error("Notifications aren't configured yet (missing VAPID key).");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission was not granted.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth_key: json.keys!.auth,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;

      setStatus("subscribed");
      toast.success("Notifications enabled on this device.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enable notifications.");
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("unsubscribed");
    toast.success("Notifications turned off on this device.");
  }, []);

  return { status, isSupported, subscribe, unsubscribe };
}
