import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const errors: Record<string, string> = {
  oauth_state: "That sign-in attempt expired. Please try again.",
  oauth_failed: "Google sign-in could not finish. Please try again.",
  gmail_access: "Allow Gmail access to continue with Mailora.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#e4e9ff_0%,#f7f8fc_45%,#f7f8fc_100%)] px-5">
    <Card className="relative w-full max-w-[390px] gap-0 rounded-2xl border-slate-200/80 bg-white py-0 shadow-[0_26px_80px_rgba(40,48,100,0.09)]">
      <CardHeader className="items-center px-8 pb-0 pt-14 text-center">
        <span className="mb-8 grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white"><MailCheck className="size-6" /></span>
        <CardTitle className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">Mailora Autopilot</CardTitle>
        {error && errors[error] && <CardDescription role="alert" className="mt-3 text-sm text-rose-600">{errors[error]}</CardDescription>}
      </CardHeader>
      <CardContent className="px-8 pb-14 pt-10 sm:px-10">
        <Button render={<a href={`${apiUrl}/auth/google`} />} nativeButton={false} variant="outline" size="lg" className="h-12 w-full rounded-xl border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50"><span aria-hidden="true" className="mr-2 bg-gradient-to-br from-[#4285f4] via-[#ea4335] to-[#34a853] bg-clip-text text-xl font-bold text-transparent">G</span>Sign in with Google</Button>
      </CardContent>
    </Card>
  </main>;
}
