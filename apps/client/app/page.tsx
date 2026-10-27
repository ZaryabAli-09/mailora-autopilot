import Link from "next/link";
import { ArrowRight, Bot, Clock3, Layers3, MailCheck, Pin, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  { icon: Layers3, title: "Know what matters", description: "Nemotron sorts recent Gmail messages into urgent, todo, meeting, and newsletter views." },
  { icon: MailCheck, title: "Read in context", description: "Open the full Gmail conversation beside your inbox without losing your place." },
  { icon: Clock3, title: "Make space to focus", description: "Pin what matters, snooze what can wait, and mark finished threads done." },
];

function Brand() {
  return <span className="flex items-center gap-3 text-white" aria-label="Mailora Autopilot">
    <span className="grid size-9 place-items-center rounded-xl border border-white/20 bg-white/10"><MailCheck className="size-5" strokeWidth={2.1} /></span>
    <span className="text-base font-semibold tracking-[-0.025em] sm:text-lg">mailora<span className="ml-1.5 font-normal text-indigo-200">autopilot</span></span>
  </span>;
}

export default function Home() {
  return <div className="flex min-h-screen flex-col bg-[#f7f8fc] text-slate-950">
    <div className="relative isolate overflow-hidden bg-[#0d1024] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_95%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-20 size-[35rem] rounded-full bg-indigo-600/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-48 bottom-0 size-[38rem] rounded-full bg-sky-500/10 blur-[120px]" />
      <header className="relative z-10 border-b border-white/10">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10" aria-label="Main navigation">
          <Brand />
          <Button render={<Link href="/login" />} nativeButton={false} variant="outline" className="rounded-full border-white/25 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white">Get started <ArrowRight className="size-4" /></Button>
        </nav>
      </header>
      <main className="relative z-10">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-28 text-center sm:pb-36 sm:pt-40">
          <Badge variant="outline" className="mb-7 gap-2 rounded-full border-indigo-300/25 bg-indigo-300/10 px-4 py-1.5 text-xs font-medium tracking-wide text-indigo-100"><Pin className="size-3.5" /> A clearer way through email</Badge>
          <h1 className="max-w-5xl text-5xl font-semibold leading-[1.04] tracking-[-0.065em] sm:text-7xl lg:text-[5.5rem]">Make room for the work <span className="text-[#b8b5ff]">that matters.</span></h1>
          <p className="mt-8 max-w-2xl text-base leading-8 text-slate-300 sm:text-xl">An AI agent that organizes your inbox and handles the busywork</p>
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="mt-10 h-12 rounded-full bg-white px-7 text-sm font-semibold text-[#171a38] shadow-[0_16px_45px_rgba(0,0,0,0.25)] hover:bg-indigo-100">Get started <ArrowRight className="size-4" /></Button>
        </section>
      </main>
    </div>
    <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-10 lg:py-28" aria-label="Features">
      <div className="mb-10 max-w-2xl"><Badge variant="secondary" className="mb-5 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">Built for the inbox you already use</Badge><h2 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">A clearer view of every conversation.</h2><p className="mt-5 text-base leading-7 text-slate-600">Mailora connects to your Gmail account, brings recent messages into one calm workspace, and helps you decide what deserves attention.</p></div>
      <div className="grid gap-5 md:grid-cols-3">
      {features.map(({ icon: Icon, title, description }) => <Card key={title} className="gap-0 rounded-2xl border-slate-200/80 bg-white py-0 shadow-[0_6px_30px_rgba(20,28,60,0.035)]">
        <CardHeader className="px-7 pt-8"><span className="mb-6 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="size-5" /></span><CardTitle className="text-lg font-semibold tracking-[-0.025em]">{title}</CardTitle></CardHeader>
        <CardContent className="px-7 pb-8 pt-3 text-sm leading-6 text-slate-600">{description}</CardContent>
      </Card>)}
      </div>
    </section>
    <section className="relative overflow-hidden bg-[#111630] px-6 py-20 text-white lg:py-28" aria-label="How Mailora works">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-0 size-[30rem] rounded-full bg-indigo-500/20 blur-[110px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div><Badge variant="outline" className="rounded-full border-indigo-300/30 bg-indigo-300/10 px-3 py-1 text-indigo-100">Your agent, your call</Badge><h2 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">Move through email with a little more help.</h2><p className="mt-6 max-w-lg text-base leading-8 text-slate-300">Ask Mailora about recent threads, see suggested next steps, and keep the final decision in your hands.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="gap-3 rounded-2xl border-white/10 bg-white/5 px-6 py-6 text-white shadow-none"><Sparkles className="size-6 text-indigo-300" /><h3 className="text-lg font-semibold">Organized by meaning</h3><p className="text-sm leading-6 text-slate-300">AI summaries and categories appear beside real Gmail messages as they finish processing.</p></Card>
          <Card className="gap-3 rounded-2xl border-white/10 bg-white/5 px-6 py-6 text-white shadow-none"><Bot className="size-6 text-indigo-300" /><h3 className="text-lg font-semibold">Ask in plain language</h3><p className="text-sm leading-6 text-slate-300">Get answers grounded in the recent inbox threads Mailora can read.</p></Card>
          <Card className="gap-3 rounded-2xl border-white/10 bg-white/5 px-6 py-6 text-white shadow-none"><ShieldCheck className="size-6 text-indigo-300" /><h3 className="text-lg font-semibold">Review every action</h3><p className="text-sm leading-6 text-slate-300">Apply suggested inbox changes yourself and edit a draft before sending.</p></Card>
          <Card className="gap-3 rounded-2xl border-white/10 bg-white/5 px-6 py-6 text-white shadow-none"><MailCheck className="size-6 text-indigo-300" /><h3 className="text-lg font-semibold">Stay connected to Gmail</h3><p className="text-sm leading-6 text-slate-300">Read conversations and send approved replies through your connected account.</p></Card>
        </div>
      </div>
    </section>
    <section className="px-6 py-20 text-center lg:py-24"><h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Ready for a calmer inbox?</h2><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600">Connect Gmail and let Mailora bring the right conversations into focus.</p><Button render={<Link href="/login" />} nativeButton={false} size="lg" className="mt-8 h-11 rounded-full bg-indigo-600 px-7 text-white hover:bg-indigo-700">Get started <ArrowRight className="size-4" /></Button></section>
    <footer className="mt-auto border-t border-slate-200 px-6 py-7 text-center text-xs text-slate-500">© {new Date().getFullYear()} Mailora Autopilot</footer>
  </div>;
}
