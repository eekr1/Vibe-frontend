import { useCallback, useRef, useState } from "react";

export type AsyncPhase =
  | "degraded"
  | "empty"
  | "error"
  | "failed"
  | "idle"
  | "initial-loading"
  | "loading-more"
  | "offline"
  | "ready"
  | "reconnecting"
  | "refreshing"
  | "submitting";

export type StateScope = "component" | "critical" | "page" | "section";

export function preservesExistingContent(phase: AsyncPhase) {
  return ["degraded", "failed", "loading-more", "offline", "reconnecting", "refreshing", "submitting"].includes(phase);
}

export function blocksWholeSurface(phase: AsyncPhase, scope: StateScope) {
  return phase === "initial-loading" && (scope === "critical" || scope === "page");
}

export type RetrySafety = {
  idempotencyKey?: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  pending?: boolean;
};

export function canRetrySafely({ idempotencyKey, method = "GET", pending = false }: RetrySafety) {
  if (pending) return false;
  return method === "GET" || Boolean(idempotencyKey);
}

export function useAsyncAction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>) {
  const gateRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (gateRef.current) return undefined;
    gateRef.current = true;
    setIsPending(true);
    try {
      return await action(...args);
    } finally {
      gateRef.current = false;
      setIsPending(false);
    }
  }, [action]);

  return { isPending, run };
}

