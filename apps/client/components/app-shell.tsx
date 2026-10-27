"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "@/components/sign-out-button";
import { ThreadList } from "@/components/inbox/thread-list";
import { ThreadReader } from "@/components/inbox/thread-reader";
import { SnoozeDialog } from "@/components/inbox/snooze-dialog";
import { AgentPanel } from "@/components/inbox/agent-panel";
import { getThread, listInbox, markDone, retrySync, setPinned, snoozeThread, type AgentAction, type InboxView, type SyncStatus, type ThreadDetail, type ThreadSummary } from "@/lib/mail-api";

export function AppShell({ user }: { user: { name: string; email: string; avatarUrl: string | null } }) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [view, setView] = useState<InboxView>("all");
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailError, setDetailError] = useState<{ id: string; message: string } | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [mobileReaderOpen, setMobileReaderOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() === query) return;
      setListLoading(true);
      setListError(null);
      setQuery(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, query]);

  useEffect(() => {
    const generation = ++listGeneration.current;
    listInbox(query, "", view).then((page) => {
      if (generation !== listGeneration.current) return;
      setThreads(page.threads);
      setNextCursor(page.nextCursor);
      setSync(page.sync);
      setSelectedId((current) => page.threads.some((item) => item.id === current)
        ? current
        : page.threads.find((item) => item.category === "focused")?.id || page.threads[0]?.id || null);
    }).catch((error: Error) => {
      if (generation === listGeneration.current) setListError(error.message);
    }).finally(() => {
      if (generation === listGeneration.current) setListLoading(false);
    });
    return () => { listGeneration.current += 1; };
  }, [query, view, reload]);

  useEffect(() => {
    if (!sync || !["queued", "syncing", "classifying"].includes(sync.status)) return;
    const timer = window.setTimeout(() => setReload((value) => value + 1), 4_000);
    return () => window.clearTimeout(timer);
  }, [sync, reload]);

  useEffect(() => {
    if (!selectedId) return;
    const generation = ++detailGeneration.current;
    getThread(selectedId).then(({ thread }) => {
      if (generation === detailGeneration.current) setDetail(thread);
    }).catch((error: Error) => {
      if (generation === detailGeneration.current) setDetailError({ id: selectedId, message: error.message });
    });
    return () => { detailGeneration.current += 1; };
  }, [selectedId, detailReload]);

  const visibleDetail = detail?.id === selectedId ? detail : null;
  const visibleDetailError = detailError?.id === selectedId ? detailError.message : null;
  const detailLoading = Boolean(selectedId && !visibleDetail && !visibleDetailError);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const generation = listGeneration.current;
    setLoadingMore(true);
    try {
      const page = await listInbox(query, nextCursor, view);
      if (generation !== listGeneration.current) return;
      setThreads((current) => {
        const known = new Set(current.map((thread) => thread.id));
        return [...current, ...page.threads.filter((thread) => !known.has(thread.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function retryBackgroundSync() {
    try {
      await retrySync();
      setReload((value) => value + 1);
    } catch (error) { toast.error((error as Error).message); }
  }

  const removeThread = useCallback((id: string) => {
    const remaining = threads.filter((thread) => thread.id !== id);
    setThreads(remaining);
    setSelectedId((current) => current === id ? (remaining.find((thread) => thread.category === "focused")?.id || null) : current);
    if (selectedId === id) setMobileReaderOpen(false);
  }, [threads, selectedId]);

  async function done() {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await markDone(selectedId);
      removeThread(selectedId);
      toast.success("Thread marked done");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }

  async function pin() {
    if (!selectedId || !detail || busy) return;
    setBusy(true);
    try {
      const { pinned } = await setPinned(selectedId, !detail.pinned);
      setThreads((current) => current.map((thread) => thread.id === selectedId ? { ...thread, pinned } : thread));
      setDetail((current) => current ? { ...current, pinned } : current);
      toast.success(pinned ? "Thread pinned" : "Thread unpinned");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }

  async function snooze(until: string) {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await snoozeThread(selectedId, until);
      removeThread(selectedId);
      setSnoozeOpen(false);
      toast.success("Thread snoozed");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }

  async function applyAgentAction(action: AgentAction) {
    if (busy) throw new Error("Wait for the current action to finish");
    setBusy(true);
    try {
      if (action.type === "done") {
        await markDone(action.threadId);
        removeThread(action.threadId);
        toast.success("Thread marked done");
      } else if (action.type === "pin") {
        await setPinned(action.threadId, true);
        setThreads((current) => current.map((thread) => thread.id === action.threadId ? { ...thread, pinned: true } : thread));
        setDetail((current) => current?.id === action.threadId ? { ...current, pinned: true } : current);
        toast.success("Thread pinned");
      } else if (action.type === "snooze" && action.until) {
        await snoozeThread(action.threadId, action.until);
        removeThread(action.threadId);
        toast.success("Thread snoozed");
      } else {
        throw new Error("This action cannot be applied");
      }
    } finally { setBusy(false); }
  }

  function afterSend() {
    setReload((current) => current + 1);
    setDetailReload((current) => current + 1);
  }

  return <main className="min-h-screen bg-[#f5f7fb] text-slate-900 lg:h-screen lg:overflow-hidden">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-[1700px] items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><MailCheck className="size-5" /></span><span className="text-lg font-semibold tracking-tight">Mailora <span className="font-medium text-slate-500">Autopilot</span></span></div>
      <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="xl:hidden" onClick={() => setAgentOpen(true)}><Bot className="size-4" /> Ask agent</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Open account menu" />}><Avatar className="size-9"><AvatarImage src={user.avatarUrl || undefined} alt={user.name} /><AvatarFallback className="bg-indigo-100 text-indigo-700">{user.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel><DropdownMenuSeparator /><SignOutButton menuItem className="w-full justify-start px-2">Sign out</SignOutButton></DropdownMenuContent></DropdownMenu></div>
    </div></header>
    <div className="mx-auto grid max-w-[1700px] gap-3 p-3 sm:p-4 lg:h-[calc(100vh-64px)] lg:grid-cols-[minmax(330px,0.42fr)_minmax(0,0.58fr)] lg:gap-4 lg:p-5 xl:grid-cols-[minmax(280px,0.27fr)_minmax(320px,0.33fr)_minmax(0,0.4fr)]">
      <Card className="hidden min-h-0 flex-col gap-0 rounded-2xl bg-white py-0 shadow-sm xl:flex"><AgentPanel selectedId={selectedId} onAction={applyAgentAction} onSent={afterSend} /></Card>
      <Card className={`${mobileReaderOpen ? "hidden" : "flex"} min-h-[calc(100vh-90px)] flex-col gap-0 rounded-2xl bg-white py-0 shadow-sm lg:flex lg:min-h-0`}>
        <ThreadList threads={threads} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setMobileReaderOpen(true); }} loading={listLoading} loadingMore={loadingMore} nextCursor={nextCursor} error={listError} retry={() => { setListLoading(true); setListError(null); setReload((value) => value + 1); }} loadMore={loadMore} search={search} onSearch={setSearch} view={view} onViewChange={(value) => { setListLoading(true); setView(value); }} sync={sync} onRetrySync={retryBackgroundSync} />
      </Card>
      <Card className={`${mobileReaderOpen ? "flex" : "hidden"} min-h-[calc(100vh-90px)] flex-col gap-0 rounded-2xl bg-white py-0 shadow-sm lg:flex lg:min-h-0`}>
        <ThreadReader thread={visibleDetail} loading={detailLoading} error={visibleDetailError} onRetry={() => { setDetailError(null); setDetailReload((value) => value + 1); }} onBack={() => setMobileReaderOpen(false)} onDone={done} onPin={pin} onSnooze={() => setSnoozeOpen(true)} busy={busy} />
      </Card>
    </div>
    <Dialog open={agentOpen} onOpenChange={setAgentOpen}><DialogContent keepMounted className="flex h-[min(85vh,740px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px] xl:hidden"><DialogTitle className="sr-only">Mailora Agent</DialogTitle><AgentPanel selectedId={selectedId} onAction={applyAgentAction} onSent={afterSend} /></DialogContent></Dialog>
    {snoozeOpen && <SnoozeDialog open={snoozeOpen} onOpenChange={setSnoozeOpen} onSnooze={snooze} busy={busy} />}
    <Toaster position="top-right" richColors />
  </main>;
}
