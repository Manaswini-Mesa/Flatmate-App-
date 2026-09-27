"use client";

import type { Session } from "@supabase/supabase-js";
import { useAuth } from "./AuthProvider";
import { GoogleButton } from "./GoogleButton";

export function RequireAuth({ next, children }: { next: string; children: (session: Session) => React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!session) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="card text-center">
          <h1 className="text-lg font-semibold">Sign in to continue</h1>
          <p className="mt-1 mb-4 text-sm text-slate-600">Use your Google account.</p>
          <GoogleButton next={next} />
        </div>
      </main>
    );
  }
  return <>{children(session)}</>;
}
