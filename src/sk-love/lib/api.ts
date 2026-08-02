// @ts-nocheck
// Centralized Laravel API client for SK Love with Dual / Failover Server Support.
// Primary: https://api.keno70.com (or user config)
// Failover Backup: https://api.sklove.nit.bd

export const DEFAULT_PRIMARY_API = "https://api.keno70.com";
export const DEFAULT_BACKUP_API = "https://api.sklove.nit.bd";

export function getBackendCandidates(): string[] {
  let custom: string | null = null;
  try {
    custom = localStorage.getItem("sk_love_api_url");
  } catch {}

  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_LARAVEL_API_URL;
  const primaryCandidate = (custom && custom.trim()) ? custom.trim().replace(/\/+$/, "") : ((envUrl && envUrl.trim()) ? envUrl.trim().replace(/\/+$/, "") : DEFAULT_PRIMARY_API);

  const backupCandidate = primaryCandidate.includes("sklove.nit.bd") ? DEFAULT_PRIMARY_API : DEFAULT_BACKUP_API;

  const list = [primaryCandidate, backupCandidate, DEFAULT_PRIMARY_API, DEFAULT_BACKUP_API]
    .map((url) => (url ? url.trim().replace(/\/+$/, "") : ""))
    .filter(Boolean);

  return Array.from(new Set(list));
}

export function getApiBaseUrl(): string {
  const candidates = getBackendCandidates();
  return candidates[0] || DEFAULT_PRIMARY_API;
}

export function setApiBaseUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem("sk_love_api_url", url.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("sk_love_api_url");
    }
  } catch {}
}

export const API_BASE_URL: string = getApiBaseUrl();

export type ApiError = {
  status: number;
  message: string;
  data?: unknown;
};

function getToken(): string | null {
  try {
    const t = localStorage.getItem("sk_love_token");
    if (!t || t === "null" || t === "undefined" || t.trim() === "") return null;
    return t.trim();
  } catch {
    return null;
  }
}

function flattenLaravelErrors(body: any): string {
  if (!body || typeof body !== "object") return "";
  const errs = (body as any).errors;
  if (errs && typeof errs === "object") {
    const list = Object.values(errs).flat().filter(Boolean) as string[];
    if (list.length) return list.join(" ");
  }
  return "";
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;
  const candidates = getBackendCandidates();

  let lastError: ApiError | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const baseUrl = candidates[i];
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(headers as Record<string, string> | undefined),
    };

    if (body instanceof FormData) {
      // no Content-Type for FormData
    } else if (body instanceof URLSearchParams) {
      if (!finalHeaders["Content-Type"]) {
        finalHeaders["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      }
    } else if (body !== undefined && body !== null) {
      if (!finalHeaders["Content-Type"]) {
        finalHeaders["Content-Type"] = "application/json";
      }
    }

    if (auth) {
      const token = getToken();
      if (token) finalHeaders.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...rest, headers: finalHeaders, body: body as any });

      // If server responded with Gateway/Server Down codes (502, 503, 504), failover to backup
      if ([502, 503, 504].includes(response.status) && i < candidates.length - 1) {
        console.warn(`[apiFetch] Server ${baseUrl} returned ${response.status}. Trying backup server...`);
        continue;
      }

      let respBody: any = null;
      try {
        respBody = await response.json();
      } catch {
        /* non-JSON body */
      }

      if (!response.ok) {
        const validation = flattenLaravelErrors(respBody);
        const err: ApiError = {
          status: response.status,
          message:
            validation ||
            respBody?.message ||
            respBody?.error ||
            `Request failed with status ${response.status}`,
          data: respBody,
        };
        throw err;
      }

      // If failover succeeded on candidate > 0, remember working backend for current session
      if (i > 0) {
        console.log(`[apiFetch] Switched to active working server: ${baseUrl}`);
        setApiBaseUrl(baseUrl);
      }

      return respBody as T;
    } catch (e: any) {
      // If it's a HTTP error (status > 0), don't failover as server responded
      if (e && typeof e === "object" && typeof e.status === "number" && e.status > 0) {
        throw e;
      }

      const rawMsg = e?.message || "Network Error";
      console.warn(`[apiFetch] Host ${baseUrl} unreachable (${rawMsg}). ${i < candidates.length - 1 ? "Attempting failover..." : "All hosts failed."}`);
      lastError = {
        status: 0,
        message: `সার্ভারে কানেক্ট করা সম্ভব হচ্ছে না (${rawMsg}).`,
      };
    }
  }

  // If all hosts failed, handle GET request default response or throw
  const method = (options.method || "GET").toUpperCase();
  if (method === "GET") {
    if (path.includes("live-rooms") || path.includes("messages") || path.includes("conversations") || path.includes("agencies") || path.includes("followers") || path.includes("search")) {
      return { data: [] } as T;
    }
    if (path.includes("unread") || path.includes("count")) {
      return { count: 0 } as T;
    }
  }

  throw lastError || { status: 0, message: "All API servers unreachable." };
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData) return body;
  if (body instanceof URLSearchParams) return body;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

export const api = {
  get: <T = any>(path: string, opts: Omit<RequestInit, "method"> & { auth?: boolean } = {}) =>
    apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T = any>(
    path: string,
    body?: unknown,
    opts: Omit<RequestInit, "method" | "body"> & { auth?: boolean } = {},
  ) =>
    apiFetch<T>(path, {
      ...opts,
      method: "POST",
      body: serializeBody(body),
    }),
  put: <T = any>(
    path: string,
    body?: unknown,
    opts: Omit<RequestInit, "method" | "body"> & { auth?: boolean } = {},
  ) =>
    apiFetch<T>(path, {
      ...opts,
      method: "PUT",
      body: serializeBody(body),
    }),
  patch: <T = any>(
    path: string,
    body?: unknown,
    opts: Omit<RequestInit, "method" | "body"> & { auth?: boolean } = {},
  ) =>
    apiFetch<T>(path, {
      ...opts,
      method: "PATCH",
      body: serializeBody(body),
    }),
  delete: <T = any>(path: string, opts: Omit<RequestInit, "method"> & { auth?: boolean } = {}) =>
    apiFetch<T>(path, { ...opts, method: "DELETE" }),
};
