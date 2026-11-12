import { useSyncExternalStore } from "react";

export type CourtLevel = "district" | "high";
const KEY = "zlc-court-level";
const listeners = new Set<() => void>();

function read(): CourtLevel {
  try {
    return localStorage.getItem(KEY) === "high" ? "high" : "district";
  } catch {
    return "district";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function setCourtLevel(level: CourtLevel) {
  try { localStorage.setItem(KEY, level); } catch { /* storage unavailable: switch still works until reload */ }
  listeners.forEach(fn => fn());
}

// Which court the app is currently showing: "district" or "high".
// Remembered on this device; every page reads it to decide what to list.
export function useCourtLevel() {
  const level = useSyncExternalStore(subscribe, read, () => "district" as CourtLevel);
  return { level, setLevel: setCourtLevel };
}
