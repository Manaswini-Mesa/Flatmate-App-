"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
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
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold text-slate-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-slate-950">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
            </svg>
          </span>
          <span>{APP_NAME}</span>
          <span className="hidden text-sm font-normal text-slate-500 sm:inline">· Pune</span>
        </Link>
        {session && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">{name}</span>
            <button onClick={signOut} className="btn-secondary px-3 py-1.5">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
