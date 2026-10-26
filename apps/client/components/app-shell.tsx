"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUp, Inbox, MailCheck, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SignOutButton } from "@/components/sign-out-button";

const prompts = ["Organize my inbox", "What needs my attention today?", "Find newsletters I can unsubscribe from"];
const categories = ["All", "Urgent", "Todos", "Meetings", "Newsletters"] as const;
type Category = (typeof categories)[number];
type Message = { role: "user" | "agent"; text: string };
const mockEmails: { sender: string; email: string; subject: string; preview: string; time: string; category: Exclude<Category, "All"> }[] = [
  { sender: "Maya Chen", email: "maya@example.com", subject: "Quick review on the launch plan", preview: "Could you take a look before we share this with the team?", time: "9:42 AM", category: "Urgent" },
  { sender: "Jonah Brooks", email: "jonah@example.com", subject: "Follow up on Tuesday's notes", preview: "I added the open questions and next steps to the document.", time: "8:18 AM", category: "Todos" },
  { sender: "Lena Ortiz", email: "lena@example.com", subject: "Coffee next week?", preview: "Would Thursday afternoon work for a quick catch up?", time: "Yesterday", category: "Meetings" },
  { sender: "The Weekly Edit", email: "weekly@example.com", subject: "Ideas worth keeping this week", preview: "A short collection of reads for a more focused week.", time: "Yesterday", category: "Newsletters" },
  { sender: "Amir Patel", email: "amir@example.com", subject: "Budget numbers are ready", preview: "The updated sheet is ready when you have a moment.", time: "Mon", category: "Todos" },
];

export function AppShell({ user }: { user: { name: string; email: string; avatarUrl: string | null } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 850);
    return () => window.clearTimeout(timer);
  }, []);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }, { role: "agent", text: "I’m ready to help. Email actions and AI replies are coming soon." }]);
    setDraft("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  const visibleEmails = useMemo(() => mockEmails.filter((email) =>
    (tab === "All" || email.category === tab) &&
    `${email.sender} ${email.subject} ${email.preview}`.toLowerCase().includes(search.toLowerCase()),
  ), [tab, search]);

  return (
    <main className="min-h-screen bg-[#f6f8fc] p-3 text-slate-900 sm:p-5 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:h-full lg:grid-cols-[minmax(350px,0.82fr)_minmax(0,1.18fr)]">
        <Card className="flex min-h-[520px] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/80 bg-white py-0 shadow-sm lg:min-h-0">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-6 py-5">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white"><MailCheck className="size-5" /></span>
            <div><CardTitle className="text-lg tracking-tight">Mailora Agent</CardTitle><p className="mt-0.5 text-xs text-slate-500">Your inbox companion</p></div>
          </CardHeader>
          <ScrollArea className="min-h-0 flex-1">
            <CardContent className="flex flex-col gap-6 px-6 py-7">
              {messages.length === 0 ? (
                <div className="py-8">
                  <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles className="size-6" /></span>
                  <h1 className="text-2xl font-semibold tracking-tight">What can I help with today?</h1>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Start with a question or choose a suggestion below.</p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    {prompts.map((prompt) => <Button key={prompt} variant="outline" className="h-auto rounded-full px-4 py-2.5 text-left text-sm font-normal whitespace-normal" onClick={() => send(prompt)}>{prompt}</Button>)}
                  </div>
                </div>
              ) : messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <Card className={`max-w-[90%] gap-0 rounded-2xl py-0 shadow-none ${message.role === "user" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-slate-50"}`}>
                    <CardContent className="px-4 py-3 text-sm leading-6">{message.text}</CardContent>
                  </Card>
                </div>
              ))}
            </CardContent>
          </ScrollArea>
          <form onSubmit={onSubmit} className="border-t border-slate-100 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
              <Input aria-label="Message Mailora Agent" placeholder="Ask Mailora anything about your inbox..." value={draft} onChange={(event) => setDraft(event.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
              <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message" className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700"><ArrowUp className="size-4" /></Button>
            </div>
          </form>
        </Card>

        <Card className="flex min-h-[560px] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/80 bg-white py-0 shadow-sm lg:min-h-0">
          <CardHeader className="flex flex-col gap-5 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex items-center justify-between gap-4">
              <div><CardTitle className="flex items-center gap-2 text-xl tracking-tight"><Inbox className="size-5 text-indigo-600" /> Inbox</CardTitle><p className="mt-1 text-xs text-slate-500">A preview of your future workspace</p></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Open account menu"><Avatar className="size-9"><AvatarImage src={user.avatarUrl || undefined} alt={user.name} /><AvatarFallback className="bg-indigo-100 text-sm font-semibold text-indigo-700">{user.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><SignOutButton className="w-full justify-start px-2">Sign out</SignOutButton></DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search inbox" placeholder="Search inbox" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 shadow-none" /></div>
            <Tabs value={tab} onValueChange={(value) => setTab(value as Category)} className="w-full">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-slate-100 bg-transparent p-0">
                {categories.map((category) => <TabsTrigger key={category} value={category} className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm text-slate-500 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-700 data-[state=active]:shadow-none">{category}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </CardHeader>
          <ScrollArea className="min-h-0 flex-1">
            <CardContent className="space-y-3 px-5 py-5 sm:px-7">
              {loading ? <><p className="py-1 text-center text-sm text-slate-500">Syncing your emails...</p>{Array.from({ length: 5 }).map((_, index) => <Card key={index} className="gap-3 rounded-xl border-slate-100 py-0 shadow-none"><CardContent className="flex items-center gap-4 px-4 py-4"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-4/5" /></div></CardContent></Card>)}</> : visibleEmails.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-500"><Inbox className="size-6" /></span><p className="font-medium">{search ? "No matching messages" : "Syncing your emails..."}</p></div>
              ) : visibleEmails.map((email) => (
                <Card key={email.sender + email.subject} className="gap-0 rounded-xl border-slate-200/80 py-0 shadow-none transition-colors hover:bg-slate-50">
                  <CardContent className="flex gap-3 px-4 py-4 sm:gap-4"><Avatar className="mt-0.5 size-10 shrink-0"><AvatarFallback className="bg-indigo-50 font-medium text-indigo-700">{email.sender.split(" ").map((word) => word[0]).join("")}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold">{email.sender}</p><span className="shrink-0 text-xs text-slate-400">{email.time}</span></div><p className="mt-1 truncate text-sm font-medium text-slate-800">{email.subject}</p><p className="mt-1 truncate text-xs text-slate-500">{email.preview}</p><Badge variant="secondary" className="mt-3 bg-indigo-50 text-[11px] font-medium text-indigo-700">{email.category}</Badge></div></CardContent>
                </Card>
              ))}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </main>
  );
}
