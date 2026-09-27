"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ListingForm } from "@/components/ListingForm";
import { RequireAuth } from "@/components/RequireAuth";
import { agreedText, PersonBreakdown } from "@/components/Results";
import { FURNISHING_LABELS, VOTE_LABELS } from "@/lib/constants";
import { evaluateListing, fmt, rentShare } from "@/lib/matching";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Listing, VoteValue } from "@/lib/types";
import { displayName, useGroupData, type GroupData } from "@/lib/useGroupData";

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireAuth next={`/listings/${id}`}>{(s) => <ListingDetail id={id} userId={s.user.id} />}</RequireAuth>;
}

function ListingDetail({ id, userId }: { id: string; userId: string }) {
  const { data, loading, error } = useGroupData(userId);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  const listing = data?.listings.find((l) => l.id === id);
  if (!data || !listing) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-slate-600">This flat doesn&apos;t exist or was deleted.</p>
        <Link href="/dashboard" className="btn-secondary mt-4">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const memberIds = data.members.map((m) => m.user_id);
  const result = evaluateListing(listing, memberIds, data.prefs, data.places, data.travelTimes, data.votes);

  async function remove() {
    if (!confirm("Delete this flat for everyone?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) alert(errorMessage(error));
    else router.replace("/dashboard");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link href="/dashboard" className="text-sm text-emerald-700 hover:underline">
        ← All flats
      </Link>

      {editing ? (
        <ListingForm groupId={data.group.id} userId={userId} listing={listing} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <ListingSummary listing={listing} data={data} onEdit={() => setEditing(true)} onDelete={remove} />
      )}

      <section className={`card ${result.agreed ? "border-emerald-300 bg-emerald-50" : ""}`}>
        <h2 className="font-semibold">{result.agreed ? "★ On the agreed shortlist" : "Your vote"}</h2>
        <p className="mt-1 text-sm text-slate-600">{agreedText(result, data.members.length)}</p>
        <VoteBar listingId={listing.id} data={data} userId={userId} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">How it works for each person</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {result.people.map((p) => (
            <PersonBreakdown key={p.userId} person={p} name={displayName(data.profiles, p.userId)} />
          ))}
        </div>
      </section>

      <TravelTimes listing={listing} data={data} userId={userId} />
      <Comments listingId={listing.id} data={data} userId={userId} />
    </main>
  );
}

function ListingSummary({ listing, data, onEdit, onDelete }: { listing: Listing; data: GroupData; onEdit: () => void; onDelete: () => void }) {
  const facts: [string, string][] = [
    ["Rent", `₹${fmt(listing.rent)}/mo · ₹${fmt(rentShare(listing.rent))} each`],
    ["Deposit", listing.deposit != null ? `₹${fmt(listing.deposit)}` : "Not sure"],
    ["Bedrooms", listing.bedrooms?.toString() ?? "Not sure"],
    ["Bathrooms", listing.bathrooms?.toString() ?? "Not sure"],
    ["Floor", listing.floor != null ? (listing.floor === 0 ? "Ground" : listing.floor.toString()) : "Not sure"],
    ["Lift", yn(listing.has_lift)],
    ["Parking", yn(listing.parking)],
    ["Pets", yn(listing.pet_friendly)],
    ["Flatmates allowed", yn(listing.sharing_allowed)],
    ["Furnishing", listing.furnishing ? FURNISHING_LABELS[listing.furnishing] : "Not sure"],
    ["Available from", listing.available_from ?? "Not sure"],
  ];
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{listing.title}</h1>
          <p className="text-sm text-slate-600">
            {listing.area}
            {listing.address && ` · ${listing.address}`} · added by {displayName(data.profiles, listing.added_by)}
          </p>
          {listing.source_url && (
            <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-emerald-700 hover:underline">
              View original listing ↗
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onEdit}>
            Edit
          </button>
          <button className="btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {listing.notes && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{listing.notes}</p>}
    </section>
  );
}

function yn(b: boolean | null) {
  return b === true ? "Yes" : b === false ? "No" : "Not sure";
}

function VoteBar({ listingId, data, userId }: { listingId: string; data: GroupData; userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const mine = data.votes.find((v) => v.listing_id === listingId && v.user_id === userId)?.vote;

  async function cast(vote: VoteValue) {
    setError(null);
    const { error } = await supabase
      .from("votes")
      .upsert({ listing_id: listingId, user_id: userId, group_id: data.group.id, vote });
    if (error) setError(errorMessage(error));
  }

  const styles: Record<VoteValue, string> = {
    shortlist: "bg-emerald-600 text-white border-emerald-600",
    discuss: "bg-amber-500 text-white border-amber-500",
    reject: "bg-red-600 text-white border-red-600",
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(VOTE_LABELS) as VoteValue[]).map((v) => (
          <button key={v} onClick={() => cast(v)} className={`btn border ${mine === v ? styles[v] : "border-slate-300 bg-white"}`} aria-pressed={mine === v}>
            {VOTE_LABELS[v]}
          </button>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
        {data.members.map((m) => {
          const v = data.votes.find((x) => x.listing_id === listingId && x.user_id === m.user_id)?.vote;
          return (
            <li key={m.user_id}>
              {displayName(data.profiles, m.user_id)}: <strong>{v ? VOTE_LABELS[v] : "—"}</strong>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TravelTimes({ listing, data, userId }: { listing: Listing; data: GroupData; userId: string }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (data.places.length === 0) {
    return (
      <section className="card">
        <h2 className="font-semibold">Travel times</h2>
        <p className="mt-1 text-sm text-slate-500">Nobody has added places (office, gym, family…) yet. Add them under My preferences.</p>
      </section>
    );
  }

  async function save(placeId: string) {
    const raw = draft[placeId];
    if (raw === undefined) return;
    setError(null);
    const res =
      raw.trim() === ""
        ? await supabase.from("travel_times").delete().match({ listing_id: listing.id, place_id: placeId })
        : await supabase.from("travel_times").upsert({
            listing_id: listing.id,
            place_id: placeId,
            group_id: data.group.id,
            minutes: Number(raw),
            updated_by: userId,
          });
    if (res.error) setError(errorMessage(res.error));
    else setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== placeId)));
  }

  const mapsLink = (label: string) =>
    `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${listing.address ?? ""} ${listing.area}, Pune`)}&destination=${encodeURIComponent(`${label}, Pune`)}`;

  return (
    <section className="card">
      <h2 className="font-semibold">Travel times (one way, minutes)</h2>
      <p className="mt-1 text-sm text-slate-500">
        Anyone can fill these in. Tip: use the Maps link to check the time at your usual travel hour.
      </p>
      <div className="mt-3 divide-y divide-slate-100">
        {data.places.map((p) => {
          const saved = data.travelTimes.find((t) => t.listing_id === listing.id && t.place_id === p.id);
          const value = draft[p.id] ?? saved?.minutes?.toString() ?? "";
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <div className="min-w-48 flex-1">
                <p>
                  <strong>{displayName(data.profiles, p.user_id)}</strong> → {p.label}
                </p>
                <p className="text-xs text-slate-500">
                  Max {p.max_minutes} min ({p.importance === "hard" ? "must" : "nice to have"}) ·{" "}
                  <a href={mapsLink(p.label)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                    Check on Google Maps ↗
                  </a>
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={600}
                className="input w-24"
                aria-label={`Minutes to ${p.label}`}
                value={value}
                placeholder="min"
                onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value })}
                onBlur={() => save(p.id)}
                onKeyDown={(e) => e.key === "Enter" && save(p.id)}
              />
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function Comments({ listingId, data, userId }: { listingId: string; data: GroupData; userId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const comments = data.comments.filter((c) => c.listing_id === listingId);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase
      .from("comments")
      .insert({ listing_id: listingId, group_id: data.group.id, user_id: userId, body: body.trim() });
    if (error) setError(errorMessage(error));
    else setBody("");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) setError(errorMessage(error));
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Discussion</h2>
      <ul className="mt-3 space-y-3">
        {comments.length === 0 && <li className="text-sm text-slate-500">No comments yet.</li>}
        {comments.map((c) => (
          <li key={c.id} className="text-sm">
            <p>
              <strong>{displayName(data.profiles, c.user_id)}</strong>{" "}
              <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString("en-IN")}</span>
              {c.user_id === userId && (
                <button onClick={() => remove(c.id)} className="ml-2 text-xs text-red-600 hover:underline">
                  delete
                </button>
              )}
            </p>
            <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={post} className="mt-4 flex gap-2">
        <input className="input" placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required />
        <button className="btn-primary shrink-0">Post</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
