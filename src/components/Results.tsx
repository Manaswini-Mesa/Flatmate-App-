"use client";

import Link from "next/link";
import { FURNISHING_LABELS, siteName, VOTE_LABELS } from "@/lib/constants";
import { fmt, GROUP_SIZE, rentShare, type CheckStatus, type ListingResult, type PersonResult } from "@/lib/matching";
import type { Listing, Vote } from "@/lib/types";
import { displayName, type GroupData } from "@/lib/useGroupData";

export function matchColor(pct: number | null): { text: string; bar: string; ring: string } {
  if (pct === null) return { text: "text-slate-500", bar: "bg-slate-600", ring: "border-slate-700" };
  if (pct >= 80) return { text: "text-emerald-400", bar: "bg-emerald-400", ring: "border-emerald-500/50" };
  if (pct >= 50) return { text: "text-amber-400", bar: "bg-amber-400", ring: "border-amber-500/50" };
  return { text: "text-red-400", bar: "bg-red-400", ring: "border-red-500/50" };
}

export function StatusPill({ status, children }: { status: CheckStatus; children: React.ReactNode }) {
  const cls =
    status === "pass"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : status === "fail"
        ? "bg-red-500/10 text-red-300 border-red-500/30"
        : "bg-amber-500/10 text-amber-300 border-amber-500/30";
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "?";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

const STATUS_WORD: Record<CheckStatus, string> = { pass: "Works", fail: "Deal-breaker", unknown: "Needs checking" };

export function MatchBadge({ pct, size = "lg" }: { pct: number | null; size?: "lg" | "xl" }) {
  const c = matchColor(pct);
  const box = size === "xl" ? "h-24 w-24 text-3xl" : "h-20 w-20 text-2xl";
  return (
    <div className={`grid shrink-0 place-items-center rounded-2xl border-2 bg-slate-950 ${box} ${c.ring}`}>
      <div className="text-center leading-none">
        <span className={`font-bold ${c.text}`}>{pct === null ? "—" : `${pct}%`}</span>
        <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">match</span>
      </div>
    </div>
  );
}

export function ListingCard({ listing, result, data, rank }: { listing: Listing; result: ListingResult; data: GroupData; rank?: number }) {
  const votes = data.votes.filter((v) => v.listing_id === listing.id);
  const site = siteName(listing.source_url);
  const breakers = result.people.filter((p) => p.hardStatus === "fail").map((p) => displayName(data.profiles, p.userId));

  return (
    <article className="card transition hover:border-slate-700">
      <div className="flex gap-4">
        <MatchBadge pct={result.match} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank !== undefined && <span className="text-xs font-semibold text-slate-500">#{rank}</span>}
            {result.agreed && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-slate-950">★ Agreed shortlist</span>}
            {!result.agreed && result.everyonePasses && (
              <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">Works for all 3</span>
            )}
            {breakers.length > 0 && (
              <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-xs font-semibold text-red-300">
                Deal-breaker for {breakers.join(", ")}
              </span>
            )}
          </div>
          <Link href={`/listings/${listing.id}`} className="mt-1 block truncate text-lg font-semibold text-slate-50 hover:text-emerald-300">
            {listing.title}
          </Link>
          <p className="text-sm text-slate-400">
            {listing.area} · ₹{fmt(rentShare(listing))}/mo each
            {listing.bedrooms != null && ` · ${listing.bedrooms} BHK`}
            {listing.furnishing && ` · ${FURNISHING_LABELS[listing.furnishing]}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link href={`/listings/${listing.id}`} className="text-emerald-400 hover:underline">
              Details & discussion →
            </Link>
            {listing.source_url && (
              <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-200 hover:underline">
                View on {site ?? "site"} ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {result.people.map((p) => (
          <PersonMini key={p.userId} person={p} name={displayName(data.profiles, p.userId)} vote={votes.find((v) => v.user_id === p.userId)} />
        ))}
      </div>
    </article>
  );
}

function PersonMini({ person, name, vote }: { person: PersonResult; name: string; vote?: Vote }) {
  const firstFail = person.hardChecks.find((c) => c.status === "fail");
  const c = matchColor(person.filledIn ? person.match : null);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-200">{name}</span>
        <span className={`text-sm font-semibold ${c.text}`}>{person.filledIn ? `${person.match}%` : "—"}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${person.filledIn ? person.match : 0}%` }} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">
        {!person.filledIn
          ? "Hasn't filled in preferences yet"
          : firstFail
            ? `✗ ${firstFail.detail}`
            : person.compromises.length
              ? `Gives up: ${person.compromises[0]}${person.compromises.length > 1 ? ` +${person.compromises.length - 1} more` : ""}`
              : person.toCheck.length
                ? `To check: ${person.toCheck[0]}`
                : "Gets everything they asked for"}
      </p>
      <p className="mt-1 text-xs text-slate-500">{vote ? `Voted ${VOTE_LABELS[vote.vote].toLowerCase()}` : "No vote yet"}</p>
    </div>
  );
}

export function PersonBreakdown({ person, name }: { person: PersonResult; name: string }) {
  const c = matchColor(person.filledIn ? person.match : null);
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-100">{name}</h3>
        <span className={`text-xl font-bold ${c.text}`}>{person.filledIn ? `${person.match}%` : "—"}</span>
      </div>
      <div className="mt-1">
        <StatusPill status={person.hardStatus}>{STATUS_WORD[person.hardStatus]}</StatusPill>
      </div>
      {!person.filledIn && <p className="mt-2 text-sm text-amber-400">Hasn&apos;t filled in preferences yet.</p>}
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Must-haves</h4>
      <ul className="mt-1 space-y-1.5">
        {person.hardChecks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            <StatusPill status={c.status}>{c.label}</StatusPill>
            <span className="text-slate-400">{c.detail}</span>
          </li>
        ))}
      </ul>
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Nice-to-haves</h4>
      {person.niceChecks.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">None set.</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {person.niceChecks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-sm">
              <StatusPill status={c.status}>{c.label}</StatusPill>
              <span className="text-slate-400">
                {c.detail} <span className="text-slate-600">(weight {c.points})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {person.compromises.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-200">
          <strong>Would compromise on:</strong> {person.compromises.join("; ")}
        </p>
      )}
    </div>
  );
}

export function agreedText(result: ListingResult, memberCount: number): string {
  if (result.agreed) return "All 3 voted shortlist and every must-have passes. This flat is on the agreed shortlist.";
  if (memberCount < GROUP_SIZE) return `Waiting for ${GROUP_SIZE - memberCount} more roommate(s) to join.`;
  if (!result.everyonePasses) {
    return result.hardFailCount > 0
      ? "Not eligible: at least one person's must-have fails."
      : "Not eligible yet: some must-haves still need checking.";
  }
  return `${result.shortlistVotes}/${GROUP_SIZE} have voted shortlist.`;
}
