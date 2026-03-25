import { API_BASE_URL } from "./config";
import {
  getToken,
  setToken,
  removeToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
} from "./auth";
import { reportError } from "./error-reporter";

const ACTIVE_COMPANY_KEY = "pitbull_active_company_id";

// Shared refresh promise prevents concurrent 401s from triggering multiple refreshes
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const token = getToken();
  const refreshToken = getRefreshToken();

  if (!token || !refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return data.token;
  } catch {
    return null;
  }
}

function clearAuthAndRedirect(): void {
  removeToken();
  removeRefreshToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;
  const method = (rest.method as string) || "GET";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Include active company ID in every request
  if (typeof window !== "undefined") {
    const activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
    if (activeCompanyId) {
      headers["X-Company-Id"] = activeCompanyId;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    // Try to refresh the token (shared promise deduplicates concurrent 401s)
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      // Retry the original request with the new token
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...rest,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (retryResponse.status === 401) {
        clearAuthAndRedirect();
        throw new ApiError(401, "Session expired");
      }

      if (retryResponse.status === 204) return undefined as T;

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => null);
        throw new ApiError(
          retryResponse.status,
          errorData?.error || errorData?.message || `Request failed with status ${retryResponse.status}`,
          errorData
        );
      }

      return retryResponse.json() as Promise<T>;
    }

    // Refresh failed — clear everything and redirect to login
    clearAuthAndRedirect();
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error || errorData?.message || `${response.status} ${response.statusText}`;

    if (response.status >= 500) {
      reportError({
        source: "frontend",
        level: "error",
        httpStatusCode: response.status,
        requestMethod: method,
        requestPath: endpoint,
        message: `API ${method} ${endpoint} returned ${response.status}: ${errorMsg}`,
      });
    }

    throw new ApiError(
      response.status,
      errorData?.error || errorData?.message || `Request failed with status ${response.status}`,
      errorData
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function uploadFiles<T>(
  endpoint: string,
  files: File[],
  fields?: Record<string, string>
): Promise<T> {
  const formData = new FormData();
  if (files.length === 1) {
    formData.append("file", files[0]);
  } else {
    for (const file of files) {
      formData.append("files", file);
    }
  }
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (typeof window !== "undefined") {
    const activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
    if (activeCompanyId) headers["X-Company-Id"] = activeCompanyId;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401) {
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (retryResponse.status === 401) {
        clearAuthAndRedirect();
        throw new ApiError(401, "Session expired");
      }

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => null);
        throw new ApiError(
          retryResponse.status,
          errorData?.error || errorData?.message || `Upload failed with status ${retryResponse.status}`,
          errorData
        );
      }

      return retryResponse.json() as Promise<T>;
    }

    clearAuthAndRedirect();
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorData?.error || errorData?.message || `Upload failed with status ${response.status}`,
      errorData
    );
  }

  return response.json() as Promise<T>;
}

function getDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/api/files/${fileId}/download`;
}

export { api, ApiError, uploadFiles, getDownloadUrl };
export default api;
