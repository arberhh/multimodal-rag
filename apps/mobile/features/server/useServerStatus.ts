import { useEffect, useState } from "react";
import { serverUrl } from "./config";

export type ServerStatus = "checking" | "connected" | "unreachable";

const TIMEOUT_MS = 5000;

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
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
      if (current) setStatus(next);
    };
    check();
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = () => {
    setStatus("checking");
    setAttempt((n) => n + 1);
  };

  return { status, retry };
}
