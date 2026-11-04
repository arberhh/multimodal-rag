import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { serverUrl } from "./config";

export type ServerStatus = "checking" | "connected" | "unreachable";

const TIMEOUT_MS = 5000;
// the header shows the status on every screen, so check again now and then to keep it true
const RECHECK_MS = 30_000;

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const check = async () => {
      let next: ServerStatus = "unreachable";
      try {
        const res = await fetch(`${serverUrl}/health`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok && (await res.json()).status === "ok") next = "connected";
      } catch {
        // no answer, or not JSON: it stays unreachable
      }
      setStatus(next);
    };
    check();

    // these checks keep the last status on screen until they answer, so it doesn't flicker
    const timer = setInterval(check, RECHECK_MS);
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      clearInterval(timer);
      foreground.remove();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus("checking");
    setAttempt((n) => n + 1);
  }, []);

  // the same object until the status changes, so screens that read it don't redraw for nothing
  return useMemo(() => ({ status, retry }), [status, retry]);
}
