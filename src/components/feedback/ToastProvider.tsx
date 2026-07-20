import { CheckCircleIcon, InfoIcon, WarningIcon, XCircleIcon, XIcon } from "@phosphor-icons/react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { IconButton } from "../ui";

export type ToastType = "error" | "info" | "success" | "warning";

export type ToastInput = {
  dedupeKey?: string;
  durationMs?: number;
  message: string;
  type?: ToastType;
};

export type ToastItem = Required<Pick<ToastInput, "message" | "type">> & {
  createdAt: number;
  dedupeKey: string;
  durationMs: number;
  id: string;
};

type ToastContextValue = {
  dismissToast: (id: string) => void;
  pushToast: (input: ToastInput) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const defaultDurations: Record<ToastType, number> = {
  error: 7000,
  info: 4200,
  success: 3200,
  warning: 5200
};

const toastIcons = {
  error: XCircleIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon
};

export function dedupeToasts(items: ToastItem[], next: ToastItem, maximum = 3) {
  if (items.some((item) => item.dedupeKey === next.dedupeKey)) return items;
  return [...items, next].slice(-maximum);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const sequenceRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const type = input.type ?? "info";
    const id = `toast-${++sequenceRef.current}`;
    const next: ToastItem = {
      createdAt: Date.now(),
      dedupeKey: input.dedupeKey ?? `${type}:${input.message}`,
      durationMs: input.durationMs ?? defaultDurations[type],
      id,
      message: input.message,
      type
    };
    setItems((current) => dedupeToasts(current, next));
    return id;
  }, []);

  useEffect(() => {
    const timers = items.map((item) => {
      const elapsed = Date.now() - item.createdAt;
      return window.setTimeout(() => dismissToast(item.id), Math.max(0, item.durationMs - elapsed));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissToast, items]);

  const value = useMemo(() => ({ dismissToast, pushToast }), [dismissToast, pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-label="Notifications" className="toast-region">
        {items.map((item) => {
          const Icon = toastIcons[item.type];
          return (
            <div
              aria-atomic="true"
              aria-live={item.type === "error" ? "assertive" : "polite"}
              className={`toast toast--${item.type}`}
              key={item.id}
              role={item.type === "error" ? "alert" : "status"}
            >
              <Icon aria-hidden="true" className="toast__icon" size={22} weight="light" />
              <p>{item.message}</p>
              <IconButton icon={<XIcon />} label="Dismiss notification" onClick={() => dismissToast(item.id)} variant="text" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}

