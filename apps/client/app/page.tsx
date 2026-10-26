import Link from "next/link";
import { ArrowRight, ListTodo, MailCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  { icon: MailCheck, title: "A calmer inbox", description: "See the messages that matter without digging through everything else." },
  { icon: ListTodo, title: "Clear next steps", description: "Keep important follow-ups and tasks in view as your day moves." },
  { icon: Sparkles, title: "A helpful agent", description: "Ask for help in plain language and spend less time on busywork." },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 text-slate-950" aria-label="Mailora Autopilot">
      <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm"><MailCheck className="size-5" strokeWidth={2.2} /></span>
      <span className="text-lg font-semibold tracking-tight">Mailora <span className="font-medium text-slate-500">Autopilot</span></span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fd] text-slate-950">
      <header className="border-b border-slate-200/70 bg-white/80">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10" aria-label="Main navigation">
          <Brand />
          <Button asChild className="rounded-full bg-indigo-600 px-5 hover:bg-indigo-700"><Link href="/login">Get started <ArrowRight className="size-4" /></Link></Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-28 text-center sm:pt-36">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm"><Sparkles className="size-4" /> Your inbox, with a little more ease</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.08] tracking-[-0.055em] sm:text-7xl">Make room for the work that matters.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">An AI agent that organizes your inbox and handles the busywork</p>
          <Button asChild size="lg" className="mt-9 h-12 rounded-full bg-indigo-600 px-8 text-base shadow-lg shadow-indigo-200 hover:bg-indigo-700"><Link href="/login">Get started <ArrowRight className="size-4" /></Link></Button>
        </section>
        <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-24 md:grid-cols-3 lg:px-10" aria-label="Features">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="rounded-2xl border-slate-200/80 bg-white py-0 shadow-sm">
              <CardHeader className="px-7 pt-8"><div className="mb-5 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="size-5" /></div><CardTitle className="text-xl tracking-tight">{title}</CardTitle></CardHeader>
              <CardContent className="px-7 pb-8 text-sm leading-6 text-slate-600">{description}</CardContent>
            </Card>
          ))}
        </section>
      </main>
      <footer className="border-t border-slate-200/70 px-6 py-6 text-center text-sm text-slate-500">© {new Date().getFullYear()} Mailora Autopilot</footer>
    </div>
  );
}
