"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data now and then re-fetches every `intervalMs` while the tab is visible.
 * Polling was chosen over WebSockets/SSE: it works on any host (Vercel + Render free tiers),
 * needs no extra infrastructure, and a few seconds of delay is fine for support tickets.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      setData(await fetcherRef.current());
      setError("");
    } catch {
      setError("Couldn't refresh. Retrying…");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
