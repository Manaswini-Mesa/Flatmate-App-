"use client";

import { useState } from "react";
import { GROUP_SIZE } from "@/lib/matching";
import { errorMessage, supabase } from "@/lib/supabase";
import { displayName, type GroupData } from "@/lib/useGroupData";

export function GroupPanel({ data, userId, onLeft }: { data: GroupData; userId: string; onLeft: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/join/${data.group.invite_code}`;
  const open = GROUP_SIZE - data.members.length;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function leave() {
    if (!confirm("Leave this group? Your preferences, places and votes will be removed.")) return;
    const { error } = await supabase.rpc("leave_group");
    if (error) setError(errorMessage(error));
    else onLeft();
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="font-semibold text-slate-100">Roommates ({data.members.length}/{GROUP_SIZE})</h2>
        <ul className="mt-3 divide-y divide-slate-800">
          {data.members.map((m) => {
            const p = data.profiles[m.user_id];
            const filled = data.prefs[m.user_id]?.max_rent_share != null;
            return (
              <li key={m.user_id} className="flex items-center gap-3 py-2">
                {p?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700 text-sm">
                    {displayName(data.profiles, m.user_id)[0]}
                  </span>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {p?.full_name ?? displayName(data.profiles, m.user_id)} {m.user_id === userId && "(you)"}
                  </p>
                  <p className="text-xs text-slate-500">{filled ? "Preferences filled in" : "Preferences not filled in yet"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {open > 0 && (
        <section className="card border-emerald-500/30 bg-emerald-500/10">
          <h2 className="font-semibold text-slate-100">Invite {open === 1 ? "your last roommate" : `${open} more roommates`}</h2>
          <p className="mt-1 text-sm text-slate-400">Send them this link, or tell them the code.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button onClick={copy} className="btn-primary shrink-0">
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 text-sm">
            Code: <span className="font-mono font-semibold tracking-wider">{data.group.invite_code}</span>
          </p>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold text-slate-100">Leave group</h2>
        <p className="mt-1 text-sm text-slate-400">Flats and comments stay for the others. Your preferences and votes are removed.</p>
        <button onClick={leave} className="btn-danger mt-3">
          Leave {data.group.name}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}
