export type ThreadCategory = "focused" | "promotions" | "updates";

export type ThreadSummary = {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  lastMessageAt: string;
  messageCount: number;
  unread: boolean;
  important: boolean;
  pinned: boolean;
  category: ThreadCategory;
  aiCategory: "urgent" | "todo" | "meeting" | "newsletter" | "other" | null;
  classificationStatus: "pending" | "ready" | "failed";
};

export type ThreadDetail = ThreadSummary & {
  messages: { id: string; from: string; to: string; date: string; body: string }[];
};

export type InboxView = "all" | "urgent" | "todo" | "meeting" | "newsletter";
export type SyncStatus = { status: "queued" | "syncing" | "classifying" | "complete" | "failed"; total: number; fetched: number; classified: number; classificationFailures: number; error: string | null };
export type InboxPage = { threads: ThreadSummary[]; nextCursor: string | null; sync: SyncStatus };

export type AgentAction = {
  type: "done" | "pin" | "snooze" | "reply";
  threadId: string;
  subject: string;
  reason: string;
  until?: string;
  draft?: string;
  recipient?: string;
};

export type AgentAnswer = { answer: string; actions: AgentAction[]; contextCount: number };

const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.method && init.method !== "GET" ? { "X-Mailora-Request": "1" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error("Could not reach Mailora. Check your connection and try again.");
  }
  if (response.status === 401) {
    window.location.href = new URL("/login", window.location.origin).toString();
    throw new Error("Please sign in again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === "GMAIL_RECONNECT") window.location.href = new URL("/connect", window.location.origin).toString();
    throw new Error(data?.message || "The request could not be completed.");
  }
  return data as T;
}

export function listInbox(search = "", cursor = "", view: InboxView = "all") {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (cursor) query.set("cursor", cursor);
  if (view !== "all") query.set("view", view);
  return request<InboxPage>(`/inbox${query.size ? `?${query}` : ""}`);
}

export function retrySync() {
  return request<{ queued: true }>("/sync", { method: "POST" });
}

export function getThread(id: string) {
  return request<{ thread: ThreadDetail }>(`/threads/${encodeURIComponent(id)}`);
}

export function markDone(id: string) {
  return request<{ done: true }>(`/threads/${encodeURIComponent(id)}/done`, { method: "POST" });
}

export function setPinned(id: string, pinned: boolean) {
  return request<{ pinned: boolean }>(`/threads/${encodeURIComponent(id)}/pin`, {
    method: "PUT", body: JSON.stringify({ pinned }),
  });
}

export function snoozeThread(id: string, until: string) {
  return request<{ snoozedUntil: string }>(`/threads/${encodeURIComponent(id)}/snooze`, {
    method: "POST", body: JSON.stringify({ until }),
  });
}

export function askAgent(prompt: string, threadId: string | null, history: { role: "user" | "assistant"; content: string }[]) {
  return request<AgentAnswer>("/agent/ask", {
    method: "POST", body: JSON.stringify({ prompt, threadId, history }),
  });
}

export function sendApprovedReply(input: { threadId: string; text: string; recipient: string; idempotencyKey: string }) {
  return request<{ sent: true; messageId: string }>("/agent/reply", {
    method: "POST", body: JSON.stringify({ ...input, confirm: true }),
  });
}
