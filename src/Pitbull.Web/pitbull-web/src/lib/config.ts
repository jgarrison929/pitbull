const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!configuredUrl && typeof window !== "undefined") {
  console.warn(
    "NEXT_PUBLIC_API_BASE_URL is not set. API calls will use relative URLs."
  );
}

export const API_BASE_URL = configuredUrl || "";
