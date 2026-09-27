"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

function urlError(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("error_description") ?? params.get("error");
}

// Google sends people back here. The Supabase client finishes the sign-in automatically,
// then we forward them to where they were going (e.g. an invite link).
export default function AuthCallback() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(urlError);

  useEffect(() => {
    if (!session) return;
    const next = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }, [session, router]);

  useEffect(() => {
    if (loading || session) return;
    const t = setTimeout(() => setProblem((p) => p ?? "Sign-in didn't finish. Please try again."), 8000);
    return () => clearTimeout(t);
  }, [loading, session]);

  return (
    <main className="mx-auto max-w-md p-6 text-center" suppressHydrationWarning>
      {problem ? (
        <>
          <p className="text-red-600">{problem}</p>
          <Link href="/" className="btn-secondary mt-4">
            Back to start
          </Link>
        </>
      ) : (
        <p className="text-slate-500">Signing you in…</p>
      )}
    </main>
  );
}
