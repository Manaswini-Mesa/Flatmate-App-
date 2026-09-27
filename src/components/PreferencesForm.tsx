"use client";

import { useState } from "react";
import { CRITERIA, FURNISHING_LABELS, PUNE_AREAS } from "@/lib/constants";
import { errorMessage, supabase } from "@/lib/supabase";
import type { CriterionSetting, Importance, Place, Preferences } from "@/lib/types";
import type { GroupData } from "@/lib/useGroupData";

const IMPORTANCE: { value: Importance; label: string }[] = [
  { value: "hard", label: "Must have" },
  { value: "nice", label: "Nice to have" },
  { value: "none", label: "Don't care" },
];

export function PreferencesForm({ data, userId }: { data: GroupData; userId: string }) {
  const existing = data.prefs[userId];
  const [rent, setRent] = useState(existing?.max_rent_share?.toString() ?? "");
  const [deposit, setDeposit] = useState(existing?.max_deposit_share?.toString() ?? "");
  const [excluded, setExcluded] = useState<string[]>(existing?.excluded_areas ?? []);
  const [otherArea, setOtherArea] = useState("");
  const [criteria, setCriteria] = useState<Record<string, CriterionSetting>>(existing?.criteria ?? {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const allAreas = Array.from(new Set([...PUNE_AREAS, ...excluded]));

  function toggleArea(a: string) {
    setExcluded((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }

  function setCriterion(key: string, patch: Partial<CriterionSetting>) {
    setCriteria((cur) => ({ ...cur, [key]: { ...(cur[key] ?? { importance: "none" }), ...patch } }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const row: Preferences = {
      group_id: data.group.id,
      user_id: userId,
      max_rent_share: rent ? Number(rent) : null,
      max_deposit_share: deposit ? Number(deposit) : null,
      excluded_areas: excluded,
      criteria,
    };
    const { error } = await supabase.from("preferences").upsert(row);
    setSaving(false);
    setMessage(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "Saved. Your roommates can see it now." });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Fill this in <strong>on your own</strong>, before looking at flats. Be honest about what&apos;s a real deal-breaker
        and what you could live without — that&apos;s what makes the comparison useful.
      </p>
      <form onSubmit={save} className="space-y-4">
        <section className="card">
          <h2 className="font-semibold">Budget (your share)</h2>
          <p className="mt-1 text-sm text-slate-500">Rent is split equally, so a ₹45,000 flat is ₹15,000 each.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rent">
                Max monthly rent share (₹) *
              </label>
              <input id="rent" className="input" type="number" min={1000} step={500} value={rent} onChange={(e) => setRent(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="dep">
                Max deposit share (₹, optional)
              </label>
              <input id="dep" className="input" type="number" min={0} step={1000} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold">Areas you won&apos;t consider</h2>
          <p className="mt-1 text-sm text-slate-500">Tap to exclude. Anything not selected is OK for you.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {allAreas.map((a) => {
              const on = excluded.includes(a);
              return (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleArea(a)}
                  className={`rounded-full border px-3 py-1 text-sm ${on ? "border-red-300 bg-red-50 text-red-700 line-through" : "border-slate-300 bg-white"}`}
                  aria-pressed={on}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input" placeholder="Another area…" value={otherArea} onChange={(e) => setOtherArea(e.target.value)} />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => {
                const a = otherArea.trim();
                if (a && !excluded.includes(a)) setExcluded([...excluded, a]);
                setOtherArea("");
              }}
            >
              Exclude
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold">Flat features</h2>
          <p className="mt-1 text-sm text-slate-500">
            <strong>Must have</strong> = the flat is out for you without it. <strong>Nice to have</strong> = you&apos;d
            compromise; the weight (1–5) says how much it matters.
          </p>
          <div className="mt-3 divide-y divide-slate-100">
            {CRITERIA.map((c) => {
              const s = criteria[c.key] ?? { importance: "none" as Importance };
              return (
                <div key={c.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.label}</p>
                    {s.importance !== "none" && c.kind !== "boolean" && (
                      <div className="mt-1">
                        {c.kind === "number" && (
                          <input
                            type="number"
                            min={1}
                            max={6}
                            className="input w-24"
                            aria-label={`${c.label} value`}
                            value={String(s.value ?? c.defaultValue ?? 1)}
                            onChange={(e) => setCriterion(c.key, { value: Number(e.target.value) })}
                          />
                        )}
                        {c.kind === "furnishing" && (
                          <select
                            className="input w-48"
                            aria-label="Minimum furnishing"
                            value={String(s.value ?? c.defaultValue)}
                            onChange={(e) => setCriterion(c.key, { value: e.target.value })}
                          >
                            <option value="semi">{FURNISHING_LABELS.semi} or better</option>
                            <option value="furnished">{FURNISHING_LABELS.furnished}</option>
                          </select>
                        )}
                        {c.kind === "date" && (
                          <input
                            type="date"
                            className="input w-48"
                            aria-label="Move in by"
                            value={String(s.value ?? "")}
                            onChange={(e) => setCriterion(c.key, { value: e.target.value })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs" role="radiogroup" aria-label={c.label}>
                      {IMPORTANCE.map((opt) => (
                        <button
                          type="button"
                          key={opt.value}
                          role="radio"
                          aria-checked={s.importance === opt.value}
                          onClick={() =>
                            setCriterion(c.key, {
                              importance: opt.value,
                              value: s.value ?? c.defaultValue,
                              weight: s.weight ?? 3,
                            })
                          }
                          className={`px-2.5 py-1.5 ${
                            s.importance === opt.value
                              ? opt.value === "hard"
                                ? "bg-red-600 text-white"
                                : opt.value === "nice"
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-600 text-white"
                              : "bg-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {s.importance === "nice" && (
                      <WeightPicker value={s.weight ?? 3} onChange={(w) => setCriterion(c.key, { weight: w })} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save my preferences"}
          </button>
          {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
        </div>
      </form>

      <PlacesEditor data={data} userId={userId} />
    </div>
  );
}

function WeightPicker({ value, onChange }: { value: number; onChange: (w: number) => void }) {
  return (
    <select className="input w-auto py-1.5 text-xs" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="How much it matters">
      {[1, 2, 3, 4, 5].map((w) => (
        <option key={w} value={w}>
          Weight {w}
        </option>
      ))}
    </select>
  );
}

function PlacesEditor({ data, userId }: { data: GroupData; userId: string }) {
  const mine = data.places.filter((p) => p.user_id === userId);
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [importance, setImportance] = useState<"hard" | "nice">("hard");
  const [weight, setWeight] = useState(3);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("places").insert({
      group_id: data.group.id,
      user_id: userId,
      label: label.trim(),
      max_minutes: Number(minutes),
      importance,
      weight,
    });
    if (error) setError(errorMessage(error));
    else setLabel("");
  }

  async function remove(p: Place) {
    const { error } = await supabase.from("places").delete().eq("id", p.id);
    if (error) setError(errorMessage(error));
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Places you need to get to</h2>
      <p className="mt-1 text-sm text-slate-500">
        Office, college, gym, family… and the longest one-way trip you&apos;ll accept. For each flat, anyone can type in the
        travel time (e.g. from Google Maps). These save straight away.
      </p>
      {mine.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <strong>{p.label}</strong> — max {p.max_minutes} min{" "}
                <span className={p.importance === "hard" ? "text-red-700" : "text-emerald-700"}>
                  ({p.importance === "hard" ? "must" : `nice to have, weight ${p.weight}`})
                </span>
              </span>
              <button onClick={() => remove(p)} className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_10rem_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="plabel">
            Place
          </label>
          <input id="plabel" className="input" placeholder="e.g. Office – Hinjewadi Phase 2" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="pmin">
            Max min
          </label>
          <input id="pmin" className="input" type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pimp">
            How strict?
          </label>
          <select id="pimp" className="input" value={importance} onChange={(e) => setImportance(e.target.value as "hard" | "nice")}>
            <option value="hard">Must</option>
            <option value="nice">Nice to have</option>
          </select>
        </div>
        {importance === "nice" ? <WeightPicker value={weight} onChange={setWeight} /> : <span />}
        <button className="btn-primary">Add place</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
