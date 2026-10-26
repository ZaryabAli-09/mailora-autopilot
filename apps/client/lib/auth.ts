import { cookies } from "next/headers";

export type Session = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  gmailConnected: boolean;
};

export async function getSession(): Promise<Session | null> {
  const session = (await cookies()).get("mailora_session")?.value;
  if (!session) return null;
  try {
    const response = await fetch(`${process.env.API_URL || "http://localhost:8000"}/auth/me`, {
      headers: { Cookie: `mailora_session=${session}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json() as Promise<Session>;
  } catch {
    return null;
  }
}
