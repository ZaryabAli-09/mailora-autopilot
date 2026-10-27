import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { Toaster } from "@/components/ui/sonner";

export default async function ConnectPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.gmailConnected) redirect("/app");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f9fd] px-5">
      <Card className="w-full max-w-sm rounded-2xl border-slate-200 bg-white py-0 shadow-xl shadow-indigo-100/50">
        <CardHeader className="items-center px-8 pb-5 pt-10 text-center"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white"><MailCheck className="size-6" /></span><CardTitle className="text-2xl tracking-tight">Connect Gmail</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 px-8 pb-10">
          <Button render={<a href={`${apiUrl}/auth/google`} />} nativeButton={false} size="lg" className="h-12 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700">Connect Gmail</Button>
          <SignOutButton variant="outline" className="h-12 w-full rounded-xl">Sign out</SignOutButton>
        </CardContent>
      </Card>
      <Toaster position="top-right" richColors />
    </main>
  );
}
