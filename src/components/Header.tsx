"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

export function Header() {
  const { session } = useAuth();
  const router = useRouter();
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white">3</span>
          <span>Flatmate Finder</span>
          <span className="hidden text-sm font-normal text-slate-500 sm:inline">· Pune</span>
        </Link>
        {session && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{name}</span>
            <button onClick={signOut} className="btn-secondary px-3 py-1.5">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
