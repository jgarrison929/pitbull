import { API_BASE_URL } from "./config";
import { getToken, removeToken } from "./auth";
import { reportError } from "./error-reporter";
import { posthog } from "./posthog";

const ACTIVE_COMPANY_KEY = "pitbull_active_company_id";

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
    removeToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    // Report errors to diagnostic tracking + PostHog
    if (response.status >= 400) {
      const method = (rest.method as string) || "GET";

      if (response.status >= 500) {
        reportError({
          source: "frontend",
          level: "error",
          httpStatusCode: response.status,
          requestMethod: method,
          requestPath: endpoint,
          message: `API ${method} ${endpoint} returned ${response.status}`,
        });
      }

      // Send all 4xx/5xx to PostHog for observability
      if (posthog.__loaded) {
        posthog.capture("api_error", {
          status: response.status,
          method,
          endpoint,
          error_message: errorData?.message || `${response.status} ${response.statusText}`,
          severity: response.status >= 500 ? "error" : "warning",
        });
      }
    }

    throw new ApiError(
      response.status,
      errorData?.message || `Request failed with status ${response.status}`,
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
    removeToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorData?.message || `Upload failed with status ${response.status}`,
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
