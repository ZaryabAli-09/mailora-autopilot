"use client";

import { useRef, useState, type FormEvent } from "react";
import { Bot, Check, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { askAgent, sendApprovedReply, type AgentAction, type AgentAnswer } from "@/lib/mail-api";

type Turn = { id: number; prompt: string; response: AgentAnswer | null; error: string | null; applied: number[] };
type Props = {
  selectedId: string | null;
  onAction: (action: AgentAction) => Promise<void>;
  onSent: () => void;
};

const presets = ["Organize my inbox", "What needs my attention today?", "Find newsletters I can unsubscribe from"];

function actionLabel(action: AgentAction) {
  if (action.type === "done") return "Mark done";
  if (action.type === "pin") return "Pin thread";
  if (action.type === "snooze") return `Snooze until ${new Date(action.until || "").toLocaleString()}`;
  return "Draft reply";
}

function ProposedAction({ action, applied, onApply, onSent }: {
  action: AgentAction; applied: boolean;
  onApply: () => Promise<void>; onSent: () => void;
}) {
  const [draft, setDraft] = useState(action.draft || "");
  const [busy, setBusy] = useState(false);
  const [sendKey] = useState(() => crypto.randomUUID());

  async function apply() {
    if (busy || applied) return;
    setBusy(true);
    try {
      if (action.type === "reply") {
        if (!draft.trim() || !action.recipient) return;
        await sendApprovedReply({ threadId: action.threadId, text: draft.trim(), recipient: action.recipient, idempotencyKey: sendKey });
        onSent();
        toast.success("Reply sent");
      } else {
        await onApply();
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally { setBusy(false); }
  }

  return <Card className="gap-2 rounded-xl border-slate-200 bg-white py-3 shadow-none">
    <CardHeader className="gap-1 px-3"><div className="flex items-center justify-between gap-2"><Badge variant="secondary" className="capitalize">{action.type}</Badge><span className="truncate text-xs text-slate-500">{action.subject}</span></div><p className="text-sm font-medium text-slate-800">{actionLabel(action)}</p>{action.reason && <p className="text-xs leading-5 text-slate-500">{action.reason}</p>}</CardHeader>
    <CardContent className="space-y-2 px-3">
      {action.type === "reply" && <><p className="text-xs text-slate-600">To: <span className="font-medium">{action.recipient}</span></p><Textarea aria-label="Review reply draft" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={20_000} rows={6} disabled={applied || busy} /></>}
      <Button size="sm" variant={action.type === "reply" ? "default" : "outline"} disabled={busy || applied || (action.type === "reply" && !draft.trim())} onClick={apply}>{applied ? <><Check className="size-3.5" /> Applied</> : action.type === "reply" ? <><Send className="size-3.5" /> {busy ? "Sending…" : "Send reviewed reply"}</> : busy ? "Applying…" : "Apply action"}</Button>
    </CardContent>
  </Card>;
}

export function AgentPanel({ selectedId, onAction, onSent }: Props) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(0);

  async function submit(prompt: string) {
    if (thinking || !prompt.trim()) return;
    const id = ++nextId.current;
    setInput("");
    setThinking(true);
    setTurns((current) => [...current, { id, prompt: prompt.trim(), response: null, error: null, applied: [] }]);
    try {
      const history = turns.filter((turn) => turn.response).slice(-3).flatMap((turn) => [
        { role: "user" as const, content: turn.prompt },
        { role: "assistant" as const, content: turn.response!.answer },
      ]);
      const response = await askAgent(prompt.trim(), selectedId, history);
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response } : turn));
    } catch (error) {
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: (error as Error).message } : turn));
    } finally { setThinking(false); }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(input);
  }

  function markApplied(turnId: number, actionIndex: number) {
    setTurns((current) => current.map((turn) => turn.id === turnId
      ? { ...turn, applied: [...turn.applied, actionIndex] } : turn));
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4"><span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Bot className="size-4" /></span><div><h2 className="text-sm font-semibold text-slate-900">Mailora Agent</h2><p className="text-xs text-slate-500">Ask about your inbox</p></div></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 p-4">
      {turns.length === 0 && <div className="space-y-4 pt-5"><div className="space-y-2 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles className="size-5" /></span><p className="text-sm font-medium text-slate-800">What can I help with?</p><p className="text-xs leading-5 text-slate-500">I can read recent inbox threads and suggest actions for you to review.</p></div><div className="space-y-2">{presets.map((preset) => <Button key={preset} variant="outline" className="h-auto w-full justify-start whitespace-normal py-2.5 text-left text-xs" disabled={thinking} onClick={() => void submit(preset)}>{preset}</Button>)}{selectedId && <Button variant="outline" className="h-auto w-full justify-start whitespace-normal py-2.5 text-left text-xs" disabled={thinking} onClick={() => void submit("Summarize this thread and draft a reply if it needs one")}>Summarize selected thread</Button>}</div></div>}
      {turns.map((turn) => <div key={turn.id} className="space-y-3"><div className="ml-7 rounded-xl bg-indigo-50 px-3 py-2 text-sm leading-6 text-slate-800">{turn.prompt}</div>{turn.error && <Card className="gap-0 rounded-xl border-red-100 bg-red-50 py-2 shadow-none"><CardContent className="px-3 text-sm text-red-700">{turn.error}</CardContent></Card>}{turn.response && <div className="space-y-2"><Card className="gap-0 rounded-xl border-slate-200 bg-white py-3 shadow-none"><CardContent className="space-y-2 px-3"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{turn.response.answer}</p><p className="text-[11px] text-slate-400">Based on {turn.response.contextCount} recent inbox {turn.response.contextCount === 1 ? "thread" : "threads"}</p></CardContent></Card>{turn.response.actions.map((action, index) => <ProposedAction key={`${action.threadId}-${action.type}-${index}`} action={action} applied={turn.applied.includes(index)} onApply={async () => { await onAction(action); markApplied(turn.id, index); }} onSent={() => { markApplied(turn.id, index); onSent(); }} />)}</div>}</div>)}
      {thinking && <Card className="gap-0 rounded-xl bg-white py-3 shadow-none"><CardContent className="px-3 text-sm text-slate-500">Reading your inbox and thinking…</CardContent></Card>}
    </div></ScrollArea>
    <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-100 p-3"><Input aria-label="Ask Mailora Agent" placeholder="Ask about your email…" value={input} onChange={(event) => setInput(event.target.value)} maxLength={2_000} disabled={thinking} /><Button type="submit" size="icon" aria-label="Send to agent" disabled={thinking || !input.trim()}><Send className="size-4" /></Button></form>
  </div>;
}
