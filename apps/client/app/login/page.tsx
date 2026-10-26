import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_30%,#e9edff_0%,#f8f9fd_42%,#fff_85%)] px-5">
      <Card className="w-full max-w-sm rounded-2xl border-slate-200/80 bg-white/95 py-0 shadow-xl shadow-indigo-100/60">
        <CardHeader className="items-center px-8 pb-5 pt-10 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white"><MailCheck className="size-6" /></span>
          <CardTitle className="text-2xl tracking-tight">Mailora Autopilot</CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <Button asChild size="lg" className="h-12 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700"><a href={`${apiUrl}/auth/google`}><span className="mr-2 text-lg font-bold">G</span> Sign in with Google</a></Button>
        </CardContent>
      </Card>
    </main>
  );
}
