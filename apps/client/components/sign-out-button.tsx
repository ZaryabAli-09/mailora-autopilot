"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton({ children = "Sign out", variant = "ghost", className = "", menuItem = false }: {
  children?: React.ReactNode;
  variant?: "ghost" | "outline";
  className?: string;
  menuItem?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/logout`, {
        method: "POST", credentials: "include", headers: { "X-Mailora-Request": "1" },
      });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/login");
      router.refresh();
    } catch { toast.error("Could not sign out. Try again."); }
    finally { setBusy(false); }
  }
  if (menuItem) return <DropdownMenuItem className={className} disabled={busy} onClick={signOut}>{children}</DropdownMenuItem>;
  return <Button type="button" variant={variant} className={className} disabled={busy} onClick={signOut}>{children}</Button>;
}
