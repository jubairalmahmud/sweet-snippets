// @ts-nocheck
// Centralized Laravel API client for SK Love.
// All real-data calls go through here so the base URL, auth header and
// error handling stay consistent.

export function getApiBaseUrl(): string {
  try {
    const customUrl = localStorage.getItem("sk_love_api_url");
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, "");
    }
  } catch {}

  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_LARAVEL_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  return "https://api.sklove.nit.bd";
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
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  // Content-Type: auto based on body type. Do NOT set for FormData (browser adds boundary).
  if (body instanceof FormData) {
    // no Content-Type
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

  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers: finalHeaders, body: body as any });
  } catch (e: any) {
    const isPlaceholder = baseUrl.includes("sklove.nit.bd");
    const rawMsg = e?.message || "Failed to fetch";

    // For background GET requests when server is unreachable, log warning & return empty default structures to prevent UI crash / toast spam
    const method = (options.method || "GET").toUpperCase();
    if (method === "GET") {
      console.warn(`[apiFetch GET failed] ${url} - ${rawMsg}`);
      if (path.includes("live-rooms") || path.includes("messages") || path.includes("conversations") || path.includes("agencies") || path.includes("followers") || path.includes("search")) {
        return { data: [] } as T;
      }
      if (path.includes("unread") || path.includes("count")) {
        return { count: 0 } as T;
      }
    }

    const detailedMsg = `সার্ভারে কানেক্ট করা সম্ভব হচ্ছে না (${rawMsg}). API Host: ${baseUrl}`;

    const err: ApiError = {
      status: 0,
      message: detailedMsg,
    };
    throw err;
  }

  let respBody: any = null;
  try {
    respBody = await response.json();
  } catch {
    /* non-JSON body is fine for empty responses */
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

  return respBody as T;
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
