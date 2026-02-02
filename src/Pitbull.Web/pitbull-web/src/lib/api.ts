import { API_BASE_URL } from "./config";
import { getToken, removeToken } from "./auth";

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

export { api, ApiError };
export default api;
