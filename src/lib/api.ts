const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type ApiSuccess<TData> = {
  data: TData;
  ok: true;
};

type ApiFailure = {
  error: {
    code: string;
    details?: unknown;
    message: string;
  };
  ok: false;
};

type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export class ApiClientError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

type ApiRequestOptions = {
  body?: unknown;
  method?: "GET" | "PATCH" | "POST";
};

export async function apiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TData> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
    headers: options.body
      ? {
          "Content-Type": "application/json"
        }
      : undefined,
    method: options.method ?? "GET"
  });
  const payload = (await response.json()) as ApiResponse<TData>;

  if (!payload.ok) {
    throw new ApiClientError(payload.error.message, payload.error.code, payload.error.details);
  }

  return payload.data;
}
