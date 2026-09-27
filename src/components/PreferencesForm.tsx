"use client";

import { useState } from "react";
import { CRITERIA, CRITERIA_SECTIONS, DIET_LABELS, FURNISHING_LABELS, PUNE_AREAS } from "@/lib/constants";
import { errorMessage, supabase } from "@/lib/supabase";
import type { CriterionSetting, Diet, Importance, Place, Preferences } from "@/lib/types";
import type { GroupData } from "@/lib/useGroupData";

const IMPORTANCE: { value: Importance; label: string; on: string }[] = [
  { value: "hard", label: "Must have", on: "bg-red-500 text-slate-950" },
  { value: "nice", label: "Nice to have", on: "bg-emerald-500 text-slate-950" },
  { value: "none", label: "Don't care", on: "bg-slate-600 text-slate-50" },
];

export function PreferencesForm({ data, userId }: { data: GroupData; userId: string }) {
  const existing = data.prefs[userId];
  const [rent, setRent] = useState(existing?.max_rent_share?.toString() ?? "");
  const [upfront, setUpfront] = useState(existing?.max_deposit_share?.toString() ?? "");
  const [diet, setDiet] = useState<Diet | "">(existing?.diet ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
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
      max_deposit_share: upfront ? Number(upfront) : null,
      excluded_areas: excluded,
      criteria,
      diet: diet || null,
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from("preferences").upsert(row);
    setSaving(false);
    setMessage(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "Saved. Every flat's match % has been updated." });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Fill this in <strong className="text-slate-200">on your own</strong>, before looking at flats. Be honest about
        what&apos;s a real deal-breaker and what you could live without — that&apos;s what makes the match % useful.
      </p>
      <form onSubmit={save} className="space-y-4">
        <Section title="About you" hint="Shown to your roommates. Not used for the match %.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="diet">
                Your food type
              </label>
              <select id="diet" className="input" value={diet} onChange={(e) => setDiet(e.target.value as Diet | "")}>
                <option value="">Prefer not to say</option>
                {Object.entries(DIET_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pnotes">
                Anything else your roommates should know
              </label>
              <textarea
                id="pnotes"
                className="input"
                rows={2}
                maxLength={1000}
                placeholder="e.g. I work from home Tue–Thu, I have a cat, I cook every day…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section title="Rent & costs (your share)" hint="Everything is split equally three ways. Both are always must-haves.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rent">
                Max monthly rent share, incl. maintenance (₹) *
              </label>
              <input id="rent" className="input" type="number" min={1000} step={500} value={rent} onChange={(e) => setRent(e.target.value)} required />
              <p className="mt-1 text-xs text-slate-500">₹45,000 rent + ₹3,000 maintenance = ₹16,000 each.</p>
            </div>
            <div>
              <label className="label" htmlFor="upfront">
                Max upfront share: deposit + brokerage (₹, optional)
              </label>
              <input id="upfront" className="input" type="number" min={0} step={1000} value={upfront} onChange={(e) => setUpfront(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Areas you won't consider" hint="Tap to exclude. Anything not crossed out is OK for you.">
          <div className="flex flex-wrap gap-2">
            {allAreas.map((a) => {
              const on = excluded.includes(a);
              return (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleArea(a)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    on ? "border-red-500/50 bg-red-500/15 text-red-300 line-through" : "border-slate-700 bg-slate-800 text-slate-200"
                  }`}
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
        </Section>

        {CRITERIA_SECTIONS.map((section) => (
          <Section
            key={section}
            title={section}
            hint={
              section === CRITERIA_SECTIONS[0]
                ? "Must have = the flat is out for you without it. Nice to have = you'd compromise; the weight (1–5) says how much it matters."
                : undefined
            }
          >
            <div className="divide-y divide-slate-800">
              {CRITERIA.filter((c) => c.section === section).map((c) => {
                const s = criteria[c.key] ?? { importance: "none" as Importance };
                return (
                  <div key={c.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{c.label}</p>
                      {s.importance !== "none" && (c.kind === "number" || c.kind === "furnishing" || c.kind === "date") && (
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
                              className="input w-56"
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
                      <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 text-xs" role="radiogroup" aria-label={c.label}>
                        {IMPORTANCE.map((opt) => (
                          <button
                            type="button"
                            key={opt.value}
                            role="radio"
                            aria-checked={s.importance === opt.value}
                            onClick={() => setCriterion(c.key, { importance: opt.value, value: s.value ?? c.defaultValue, weight: s.weight ?? 3 })}
                            className={`px-2.5 py-1.5 font-medium ${s.importance === opt.value ? opt.on : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {s.importance === "nice" && <WeightPicker value={s.weight ?? 3} onChange={(w) => setCriterion(c.key, { weight: w })} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        ))}

        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save my preferences"}
          </button>
          {message && <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
        </div>
      </form>

      <PlacesEditor data={data} userId={userId} />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="font-semibold text-slate-100">{title}</h2>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
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
    <Section
      title="Places you need to get to"
      hint="Office, college, gym, family… and the longest one-way trip you'll accept. These save straight away."
    >
      {mine.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-800">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-slate-200">
                <strong>{p.label}</strong> — max {p.max_minutes} min{" "}
                <span className={p.importance === "hard" ? "text-red-400" : "text-emerald-400"}>
                  ({p.importance === "hard" ? "must" : `nice to have, weight ${p.weight}`})
                </span>
              </span>
              <button onClick={() => remove(p)} className="text-sm text-red-400 hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_7rem_10rem_auto_auto] sm:items-end">
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
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Section>
  );
}
