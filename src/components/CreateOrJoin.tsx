"use client";

import { useState } from "react";
import { errorMessage, supabase } from "@/lib/supabase";

export function CreateOrJoin({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("Our Pune flat");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onDone();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Start with your group</h1>
      <p className="mt-1 text-slate-600">One person creates the group and shares the invite. The other two join. Max 3 people.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => supabase.rpc("create_group", { group_name: name }));
          }}
        >
          <h2 className="font-semibold">Create a new group</h2>
          <label className="label mt-3" htmlFor="gname">
            Group name
          </label>
          <input id="gname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          <button className="btn-primary mt-4 w-full" disabled={busy}>
            Create group
          </button>
        </form>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => supabase.rpc("join_group", { code }));
          }}
        >
          <h2 className="font-semibold">Join with an invite code</h2>
          <label className="label mt-3" htmlFor="gcode">
            Invite code
          </label>
          <input
            id="gcode"
            className="input font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 7F3A9C21"
            maxLength={8}
            required
          />
          <button className="btn-secondary mt-4 w-full" disabled={busy}>
            Join group
          </button>
        </form>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
