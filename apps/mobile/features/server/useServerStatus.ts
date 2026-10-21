import { useEffect, useState } from "react";
import { serverUrl } from "./config";

export type ServerStatus = "checking" | "connected" | "unreachable";

const TIMEOUT_MS = 5000;

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then(async (res) =>
        (await res.json()).status === "ok" && res.ok ? "connected" : "unreachable",
      )
      .catch(() => "unreachable" as const)
      .then((next) => {
        if (current) setStatus(next);
      });
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
