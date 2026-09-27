"use client";

import { useState } from "react";
import { errorMessage, supabase } from "@/lib/supabase";

// Simple email + password sign-in. "Confirm email" is turned off in Supabase,
// so a new account can be used straight away — no emails are sent.
export function SignInForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(friendly(errorMessage(error)));
    // On success the AuthProvider picks up the new session and the page moves on by itself.
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-3 text-left">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-md py-1.5 font-medium ${mode === m ? "bg-white shadow-sm" : "text-slate-600"}`}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya" required maxLength={60} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "signup" && <p className="mt-1 text-xs text-slate-500">At least 6 characters.</p>}
      </div>
      <button className="btn-primary w-full py-2.5" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function friendly(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/already registered/i.test(msg)) return "That email already has an account — use Sign in instead.";
  return msg;
}
