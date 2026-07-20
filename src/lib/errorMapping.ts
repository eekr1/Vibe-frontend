import { ApiClientError } from "./api";

export type SafeErrorCategory =
  | "authentication"
  | "conflict"
  | "feature"
  | "network"
  | "permission"
  | "rate-limit"
  | "room-state"
  | "unknown"
  | "validation";

export type SafeErrorMessage = {
  category: SafeErrorCategory;
  message: string;
  retryable: boolean;
  title: string;
};

const exactCodeCategories: Record<string, SafeErrorCategory> = {
  ACCOUNT_BANNED: "permission",
  ACCOUNT_RESTRICTED: "permission",
  ACCOUNT_SUSPENDED: "permission",
  AUTHENTICATION_REQUIRED: "authentication",
  CONFLICT: "conflict",
  CSRF_BOOTSTRAP_FAILED: "network",
  FEATURE_DISABLED: "feature",
  FORBIDDEN: "permission",
  HTTP_RESPONSE_INVALID: "network",
  LIMIT_REACHED: "rate-limit",
  NETWORK_ERROR: "network",
  NOT_ALLOWED: "permission",
  RATE_LIMITED: "rate-limit",
  ROOM_ENDED: "room-state",
  ROOM_FULL: "room-state",
  ROOM_NOT_LIVE: "room-state",
  ROOM_PASSWORD_REQUIRED: "room-state",
  ROOM_USER_BANNED: "permission",
  UNAUTHORIZED: "authentication",
  VALIDATION_FAILED: "validation"
};

function categoryForCode(code: string): SafeErrorCategory {
  const normalized = code.trim().toUpperCase();
  if (exactCodeCategories[normalized]) return exactCodeCategories[normalized];
  if (normalized.includes("VALIDATION") || normalized.startsWith("INVALID_")) return "validation";
  if (normalized.includes("RATE") || normalized.includes("COOLDOWN") || normalized.includes("LIMIT")) return "rate-limit";
  if (normalized.includes("CONFLICT") || normalized.includes("DUPLICATE") || normalized === "P2002") return "conflict";
  if (normalized.includes("AUTH") || normalized.includes("SESSION")) return "authentication";
  if (normalized.includes("FORBIDDEN") || normalized.includes("PERMISSION") || normalized.includes("BLOCK")) return "permission";
  if (normalized.includes("FEATURE") || normalized.includes("UNAVAILABLE")) return "feature";
  if (normalized.includes("ROOM_")) return "room-state";
  if (normalized.includes("NETWORK") || normalized.includes("HTTP") || normalized.includes("TIMEOUT")) return "network";
  return "unknown";
}

const messages: Record<SafeErrorCategory, SafeErrorMessage> = {
  authentication: {
    category: "authentication",
    message: "Log in again, then retry this action.",
    retryable: false,
    title: "Your session needs attention."
  },
  conflict: {
    category: "conflict",
    message: "The latest state changed before this action finished. Refresh and try again.",
    retryable: true,
    title: "This action could not be completed."
  },
  feature: {
    category: "feature",
    message: "This part of Vibehall is not available right now.",
    retryable: false,
    title: "This feature is unavailable."
  },
  network: {
    category: "network",
    message: "Check your connection and try again.",
    retryable: true,
    title: "We could not reach Vibehall."
  },
  permission: {
    category: "permission",
    message: "This action is not available for your current access.",
    retryable: false,
    title: "This action is unavailable."
  },
  "rate-limit": {
    category: "rate-limit",
    message: "Wait a moment before trying again.",
    retryable: true,
    title: "Too many attempts."
  },
  "room-state": {
    category: "room-state",
    message: "Return to the hall or choose another live room.",
    retryable: false,
    title: "This room is no longer available."
  },
  unknown: {
    category: "unknown",
    message: "Try again in a moment.",
    retryable: true,
    title: "Something went wrong."
  },
  validation: {
    category: "validation",
    message: "Check the information you entered and try again.",
    retryable: false,
    title: "Some information needs attention."
  }
};

export function mapErrorToSafeMessage(error: unknown, fallback?: Partial<Pick<SafeErrorMessage, "message" | "title">>): SafeErrorMessage {
  const category = error instanceof ApiClientError ? categoryForCode(error.code) : "unknown";
  return {
    ...messages[category],
    ...(fallback?.title ? { title: fallback.title } : {}),
    ...(fallback?.message ? { message: fallback.message } : {})
  };
}

export function safeErrorText(error: unknown, fallback = "Try again in a moment.") {
  const mapped = mapErrorToSafeMessage(error);
  return mapped.category === "unknown" ? fallback : mapped.message;
}
