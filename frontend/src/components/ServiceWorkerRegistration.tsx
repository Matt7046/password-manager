import { useEffect } from "react";
import { Platform } from "react-native";

/** Registers the PWA service worker on web (same pattern as Activity Manager). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[pwa] SW registration failed", err));
  }, []);

  return null;
}
