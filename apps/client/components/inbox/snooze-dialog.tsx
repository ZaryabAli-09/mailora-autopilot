"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function localInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SnoozeDialog({ open, onOpenChange, onSnooze, busy }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnooze: (until: string) => Promise<void>;
  busy: boolean;
}) {
  const [initial] = useState(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return { minimum: localInputValue(new Date(now.getTime() + 60_000)), value: localInputValue(tomorrow) };
  });
  const [value, setValue] = useState(initial.value);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const until = new Date(value);
    if (!Number.isFinite(until.getTime())) return;
    await onSnooze(until.toISOString());
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Snooze thread</DialogTitle><DialogDescription>Move this thread out of your inbox until the time you choose.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-5"><Input aria-label="Snooze until" type="datetime-local" required min={initial.minimum} value={value} onChange={(event) => setValue(event.target.value)} className="w-full" /><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || !value} className="bg-indigo-600 hover:bg-indigo-700">{busy ? "Snoozing..." : "Snooze"}</Button></DialogFooter></form>
    </DialogContent>
  </Dialog>;
}
