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
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
};

let csrfToken: string | null | undefined;

async function getCsrfToken() {
  if (csrfToken !== undefined) return csrfToken;
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new ApiClientError("Could not initialize request security.", "CSRF_BOOTSTRAP_FAILED");
  const payload = (await response.json()) as ApiSuccess<{ token: string | null }>;
  if (payload.data.token) csrfToken = payload.data.token;
  return payload.data.token;
}

export async function apiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TData> {
  const method = options.method ?? "GET";
  const token = method === "GET" ? null : await getCsrfToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-CSRF-Token": token } : {})
    },
    method
  });
  const responseText = await response.text();
  let payload: ApiResponse<TData>;

  try {
    payload = JSON.parse(responseText) as ApiResponse<TData>;
  } catch {
    throw new ApiClientError(
      response.ok ? "The server returned an unreadable response." : "The server request failed.",
      "HTTP_RESPONSE_INVALID",
      {
        path,
        status: response.status,
        text: responseText.slice(0, 300)
      }
    );
  }

  if (!payload.ok) {
    throw new ApiClientError(payload.error.message, payload.error.code, payload.error.details);
  }

  if (path.startsWith("/auth/") && method !== "GET") csrfToken = undefined;

  return payload.data;
}

export async function apiUploadRequest<TData>(
  path: string,
  body: FormData,
  onProgress?: (percent: number) => void
): Promise<TData> {
  const token = await getCsrfToken();
  return new Promise<TData>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}${path}`);
    request.withCredentials = true;
    request.setRequestHeader("Accept", "application/json");
    if (token) request.setRequestHeader("X-CSRF-Token", token);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener("error", () => reject(new ApiClientError("Avatar upload failed.", "NETWORK_ERROR")));
    request.addEventListener("load", () => {
      let payload: ApiResponse<TData>;
      try { payload = JSON.parse(request.responseText) as ApiResponse<TData>; }
      catch { reject(new ApiClientError("The server returned an unreadable response.", "HTTP_RESPONSE_INVALID")); return; }
      if (!payload.ok) { reject(new ApiClientError(payload.error.message, payload.error.code, payload.error.details)); return; }
      onProgress?.(100);
      resolve(payload.data);
    });
    request.send(body);
  });
}
