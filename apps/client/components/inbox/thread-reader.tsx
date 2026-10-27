"use client";

import { ArrowLeft, Check, Clock3, MailOpen, Pin, PinOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ThreadDetail } from "@/lib/mail-api";

type Props = {
  thread: ThreadDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  onDone: () => void;
  onPin: () => void;
  onSnooze: () => void;
  busy: boolean;
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "";
}

export function ThreadReader({ thread, loading, error, onRetry, onBack, onDone, onPin, onSnooze, busy }: Props) {
  return <>
    <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to inbox" className="lg:hidden"><ArrowLeft className="size-4" /></Button><span className="truncate text-sm font-semibold text-slate-700">Conversation</span></div>
      {thread && <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onSnooze} title="Snooze"><Clock3 className="size-4" /><span className="hidden sm:inline">Snooze</span></Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onPin} title={thread.pinned ? "Unpin" : "Pin"}>{thread.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}<span className="hidden sm:inline">{thread.pinned ? "Unpin" : "Pin"}</span></Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={onDone} title="Mark done"><Check className="size-4" /><span className="hidden sm:inline">Done</span></Button>
      </div>}
    </CardHeader>
    <ScrollArea className="min-h-0 flex-1">
      {loading && <div className="space-y-6 p-6"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-44 w-full" /><Skeleton className="h-36 w-full" /></div>}
      {!loading && error && <div className="grid min-h-[400px] place-content-center px-6 text-center"><p className="text-sm text-slate-600">{error}</p><Button variant="outline" onClick={onRetry} className="mx-auto mt-4">Try again</Button></div>}
      {!loading && !error && !thread && <div className="grid min-h-[460px] place-content-center px-6 text-center"><span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500"><MailOpen className="size-7" /></span><p className="text-lg font-medium text-slate-800">Select a conversation</p><p className="mt-1 text-sm text-slate-500">Your email will appear here.</p></div>}
      {!loading && !error && thread && <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-9">
        <div className="mb-7"><Badge variant="secondary" className="mb-4 capitalize text-indigo-700">{thread.category}</Badge><h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">{thread.subject}</h1><p className="mt-2 text-sm text-slate-500">{thread.messageCount} {thread.messageCount === 1 ? "message" : "messages"}</p></div>
        <div className="space-y-4">{thread.messages.map((message) => <Card key={message.id} className="gap-0 rounded-xl bg-white py-0 shadow-none"><CardHeader className="flex flex-row items-start gap-3 border-b border-slate-100 px-5 py-4"><Avatar className="size-9 shrink-0"><AvatarFallback className="bg-indigo-50 text-xs font-medium text-indigo-700">{message.from.trim().slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{message.from || "Unknown sender"}</p><p className="mt-0.5 truncate text-xs text-slate-500">To: {message.to || "Undisclosed recipients"}</p></div><span className="shrink-0 text-xs text-slate-400">{displayDate(message.date)}</span></CardHeader><CardContent className="whitespace-pre-wrap break-words px-5 py-5 text-sm leading-7 text-slate-700">{message.body || "No text content is available for this message."}</CardContent></Card>)}</div>
      </div>}
    </ScrollArea>
  </>;
}
