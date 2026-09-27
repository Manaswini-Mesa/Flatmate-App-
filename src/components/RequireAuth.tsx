"use client";

import type { Session } from "@supabase/supabase-js";
import { useAuth } from "./AuthProvider";
import { SignInForm } from "./SignInForm";

// Shows the sign-in form in place of the page until someone is signed in,
// so invite links (/join/CODE) keep working after signing in.
export function RequireAuth({ children }: { children: (session: Session) => React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!session) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center p-6">
        <h1 className="mb-4 text-lg font-semibold">Sign in to continue</h1>
        <SignInForm />
      </main>
    );
  }
  return <>{children(session)}</>;
}
