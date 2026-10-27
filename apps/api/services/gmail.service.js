import { ApiError } from "../utils/apiError.js";
import { accessTokenFor, invalidateGmailAccess } from "./google-token.service.js";

const apiRoot = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function gmailRequest(user, path, { method = "GET", query = {}, body } = {}) {
  const url = new URL(`${apiRoot}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
    else if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await accessTokenFor(user, { forceRefresh: attempt === 1 });
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ApiError(502, "Gmail is temporarily unavailable");
    }
    if (response.status === 401 && attempt === 0) continue;
    if (response.status === 401) await invalidateGmailAccess(user);
    if (response.status === 403) {
      const errorBody = await response.json().catch(() => null);
      const reason = errorBody?.error?.errors?.[0]?.reason;
      if (reason === "insufficientPermissions") await invalidateGmailAccess(user);
      if (reason === "accessNotConfigured") {
        const error = new ApiError(503, "Gmail API is not enabled for Mailora yet");
        error.code = "GMAIL_API_DISABLED";
        throw error;
      }
      throw new ApiError(503, "Gmail access is unavailable right now");
    }
    if (response.status === 404) throw new ApiError(404, "Thread not found");
    if (response.status === 429 || response.status >= 500) throw new ApiError(503, "Gmail is temporarily unavailable");
    if (!response.ok) throw new ApiError(502, "Gmail request failed");
    return response.status === 204 ? null : response.json();
  }
  throw new ApiError(502, "Gmail request failed");
}

export function threadPath(threadId) {
  if (!/^[a-zA-Z0-9_-]{5,128}$/.test(threadId)) throw new ApiError(400, "Invalid thread ID");
  return `/threads/${encodeURIComponent(threadId)}`;
}
