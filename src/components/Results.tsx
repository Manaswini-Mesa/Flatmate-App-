"use client";

import Link from "next/link";
import { FURNISHING_LABELS, VOTE_LABELS } from "@/lib/constants";
import { fmt, GROUP_SIZE, rentShare, type CheckStatus, type ListingResult, type PersonResult } from "@/lib/matching";
import type { Listing, Vote } from "@/lib/types";
import { displayName, type GroupData } from "@/lib/useGroupData";

export function StatusPill({ status, children }: { status: CheckStatus; children: React.ReactNode }) {
  const cls =
    status === "pass"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "fail"
        ? "bg-red-50 text-red-800 border-red-200"
        : "bg-amber-50 text-amber-800 border-amber-200";
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "?";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

const STATUS_WORD: Record<CheckStatus, string> = { pass: "Works", fail: "Deal-breaker", unknown: "Needs checking" };

export function ListingCard({ listing, result, data }: { listing: Listing; result: ListingResult; data: GroupData }) {
  const votes = data.votes.filter((v) => v.listing_id === listing.id);
  return (
    <Link href={`/listings/${listing.id}`} className="card block transition hover:border-emerald-300 hover:shadow">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{listing.title}</h3>
          <p className="text-sm text-slate-600">
            {listing.area} · ₹{fmt(listing.rent)}/mo (₹{fmt(rentShare(listing.rent))} each)
            {listing.bedrooms != null && ` · ${listing.bedrooms} BHK`}
            {listing.furnishing && ` · ${FURNISHING_LABELS[listing.furnishing]}`}
          </p>
        </div>
        {result.agreed ? (
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">★ Agreed shortlist</span>
        ) : result.everyonePasses ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Works for all 3</span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {result.people.map((p) => (
          <PersonMini key={p.userId} person={p} name={displayName(data.profiles, p.userId)} vote={votes.find((v) => v.user_id === p.userId)} />
        ))}
      </div>
    </Link>
  );
}

function PersonMini({ person, name, vote }: { person: PersonResult; name: string; vote?: Vote }) {
  const firstFail = person.hardChecks.find((c) => c.status === "fail");
  return (
    <div className="rounded-lg bg-slate-50 p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{name}</span>
        <StatusPill status={person.hardStatus}>{STATUS_WORD[person.hardStatus]}</StatusPill>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {firstFail
          ? firstFail.detail
          : person.compromises.length
            ? `Gives up: ${person.compromises[0]}${person.compromises.length > 1 ? ` +${person.compromises.length - 1}` : ""}`
            : person.toCheck.length
              ? `To check: ${person.toCheck[0]}`
              : "Gets everything they asked for"}
      </p>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>Score {person.score}%</span>
        <span>{vote ? `Voted ${VOTE_LABELS[vote.vote].toLowerCase()}` : "No vote yet"}</span>
      </div>
    </div>
  );
}

export function PersonBreakdown({ person, name }: { person: PersonResult; name: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{name}</h3>
        <StatusPill status={person.hardStatus}>{STATUS_WORD[person.hardStatus]}</StatusPill>
      </div>
      {!person.filledIn && <p className="mt-2 text-sm text-amber-700">Hasn&apos;t filled in preferences yet.</p>}
      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Must-haves</h4>
      <ul className="mt-1 space-y-1">
        {person.hardChecks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            <StatusPill status={c.status}>{c.label}</StatusPill>
            <span className="text-slate-600">{c.detail}</span>
          </li>
        ))}
      </ul>
      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Nice-to-haves · score {person.score}%
      </h4>
      {person.niceChecks.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">None set.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {person.niceChecks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-sm">
              <StatusPill status={c.status}>{c.label}</StatusPill>
              <span className="text-slate-600">
                {c.detail} <span className="text-slate-400">(weight {c.weight})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {person.compromises.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
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
