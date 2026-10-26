"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton({ children = "Sign out", variant = "ghost", className = "" }: {
  children?: React.ReactNode;
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/logout`, {
        method: "POST", credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return <Button type="button" variant={variant} className={className} disabled={busy} onClick={signOut}>{children}</Button>;
}
