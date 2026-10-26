import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.gmailConnected) redirect("/connect");
  return <AppShell user={session.user} />;
}
