"use client";

import { useState } from "react";
import { ChevronDown, Inbox, Layers3, Pin, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InboxView, SyncStatus, ThreadCategory, ThreadSummary } from "@/lib/mail-api";

type Props = {
  threads: ThreadSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
  error: string | null;
  retry: () => void;
  loadMore: () => void;
  search: string;
  onSearch: (value: string) => void;
  view: InboxView;
  onViewChange: (value: InboxView) => void;
  sync: SyncStatus | null;
  onRetrySync: () => void;
};

const views: { value: InboxView; label: string }[] = [
  { value: "all", label: "All" }, { value: "urgent", label: "Urgent" },
  { value: "todo", label: "Todos" }, { value: "meeting", label: "Meetings" },
  { value: "newsletter", label: "Newsletters" },
];

const aiLabels = { urgent: "Urgent", todo: "Todo", meeting: "Meeting", newsletter: "Newsletter", other: "General" };

function senderName(raw: string) {
  return raw.split("<")[0].trim().replace(/^"|"$/g, "") || raw;
}

function timestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function ThreadRow({ thread, selected, onSelect }: { thread: ThreadSummary; selected: boolean; onSelect: () => void }) {
  const name = senderName(thread.sender);
  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`h-auto w-full items-start justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal transition-colors ${selected ? "bg-indigo-50 hover:bg-indigo-50" : "hover:bg-slate-50"}`}
    >
      <Avatar className="mt-0.5 size-9 shrink-0"><AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-600">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${thread.unread ? "font-semibold text-slate-950" : "font-medium text-slate-700"}`}>{name}</span><span className="shrink-0 text-xs font-normal text-slate-400">{timestamp(thread.lastMessageAt)}</span></span>
        <span className={`mt-1 block truncate text-sm ${thread.unread ? "font-semibold text-slate-900" : "font-normal text-slate-700"}`}>{thread.subject}</span>
        <span className="mt-1 block truncate text-xs font-normal text-slate-500">{thread.snippet}</span>
        <span className="mt-2 flex items-center gap-2">{thread.aiCategory && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{aiLabels[thread.aiCategory]}</Badge>}{thread.classificationStatus === "pending" && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Classifying</Badge>}{thread.classificationStatus === "failed" && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Classification pending</Badge>}{thread.pinned && <Pin className="size-3 text-indigo-600" aria-label="Pinned" />}{thread.messageCount > 1 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{thread.messageCount} messages</Badge>}{thread.important && <span className="size-1.5 rounded-full bg-amber-400" aria-label="Important" />}</span>
      </span>
    </Button>
  );
}

const bundleNames: Record<Exclude<ThreadCategory, "focused">, string> = {
  promotions: "Promotions",
  updates: "Updates",
};

export function ThreadList({ threads, selectedId, onSelect, loading, loadingMore, nextCursor, error, retry, loadMore, search, onSearch, view, onViewChange, sync, onRetrySync }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const focused = view === "all" ? threads.filter((thread) => thread.category === "focused") : threads;
  const isProcessing = sync && ["queued", "syncing", "classifying"].includes(sync.status);

  return (
    <>
      <CardHeader className="gap-4 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Inbox className="size-5 text-indigo-600" /> Inbox</CardTitle>{sync && <Badge variant="secondary" className="bg-slate-100 text-slate-600">{sync.status === "syncing" ? `Syncing ${sync.fetched}/${sync.total}` : sync.status === "classifying" ? `Classifying ${sync.classified + sync.classificationFailures}/${sync.total}` : sync.status === "queued" ? "Sync queued" : sync.status === "failed" ? "Sync paused" : `${threads.length} shown`}</Badge>}</div>
        <div className="relative w-full"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search your inbox" placeholder="Search your inbox" value={search} onChange={(event) => onSearch(event.target.value)} className="h-10 w-full rounded-lg bg-slate-50 pl-10 shadow-none" /></div>
        <Tabs value={view} onValueChange={(value) => onViewChange(value as InboxView)} className="w-full overflow-x-auto">
          <TabsList variant="line" className="min-w-max justify-start rounded-none bg-transparent p-0">{views.map((item) => <TabsTrigger key={item.value} value={item.value} className="px-3 data-active:text-indigo-700 data-active:after:bg-indigo-600">{item.label}</TabsTrigger>)}</TabsList>
        </Tabs>
      </CardHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3 sm:p-4">
          {loading && Array.from({ length: 7 }).map((_, index) => <div key={index} className="flex gap-3 px-3 py-3"><Skeleton className="size-9 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /></div></div>)}
          {!loading && error && <div className="px-4 py-16 text-center"><p className="text-sm text-slate-600">{error}</p><Button variant="outline" onClick={retry} className="mt-4">Try again</Button></div>}
          {!loading && !error && sync?.status === "failed" && <div className="rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-900"><p>{sync.error || "Sync paused. Try again."}</p><Button variant="outline" size="sm" onClick={onRetrySync} className="mt-3">Retry sync</Button></div>}
          {!loading && !error && sync?.status === "complete" && sync.classificationFailures > 0 && <div className="rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-900"><p>{sync.classificationFailures} {sync.classificationFailures === 1 ? "email needs" : "emails need"} another classification attempt.</p><Button variant="outline" size="sm" onClick={onRetrySync} className="mt-3">Retry classification</Button></div>}
          {!loading && !error && threads.length === 0 && <div className="px-4 py-16 text-center"><Inbox className="mx-auto mb-4 size-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">{search ? "No messages found" : isProcessing ? (sync.status === "classifying" && view !== "all" ? "Classifying your emails..." : "Syncing your emails...") : view === "all" ? "Your inbox is clear" : `No ${views.find((item) => item.value === view)?.label.toLowerCase()} emails yet`}</p></div>}
          {!loading && !error && focused.length > 0 && <section aria-label={view === "all" ? "Focused threads" : `${view} threads`}>{view === "all" && <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Focused</p>}{focused.map((thread) => <ThreadRow key={thread.id} thread={thread} selected={selectedId === thread.id} onSelect={() => onSelect(thread.id)} />)}</section>}
          {!loading && !error && view === "all" && (["promotions", "updates"] as const).map((category) => {
            const bundled = threads.filter((thread) => thread.category === category);
            if (!bundled.length) return null;
            const open = Boolean(expanded[category]);
            return <section key={category} aria-label={`${bundleNames[category]} bundle`} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-1">
              <Button variant="ghost" aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [category]: !current[category] }))} className="h-auto w-full justify-start gap-3 px-3 py-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600"><Layers3 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{bundleNames[category]} <span className="font-normal text-slate-400">· {bundled.length}</span></span><span className="block truncate text-xs font-normal text-slate-500">{bundled.slice(0, 2).map((thread) => senderName(thread.sender)).join(", ")}</span></span><ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} /></Button>
              {open && <div className="border-t border-slate-200/70 pt-1">{bundled.map((thread) => <ThreadRow key={thread.id} thread={thread} selected={selectedId === thread.id} onSelect={() => onSelect(thread.id)} />)}</div>}
            </section>;
          })}
          {!loading && !error && nextCursor && <Button variant="outline" disabled={loadingMore} onClick={loadMore} className="w-full">{loadingMore ? "Loading..." : "Load more"}</Button>}
        </div>
      </ScrollArea>
    </>
  );
}
