"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateOrJoin } from "@/components/CreateOrJoin";
import { GroupPanel } from "@/components/GroupPanel";
import { ListingForm } from "@/components/ListingForm";
import { PreferencesForm } from "@/components/PreferencesForm";
import { RequireAuth } from "@/components/RequireAuth";
import { ListingCard, matchColor } from "@/components/Results";
import { evaluateListing, GROUP_SIZE, rankResults } from "@/lib/matching";
import { useGroupData, type GroupData } from "@/lib/useGroupData";

type Tab = "flats" | "prefs" | "shortlist" | "group";

export default function DashboardPage() {
  return <RequireAuth>{(session) => <Dashboard userId={session.user.id} />}</RequireAuth>;
}

function Dashboard({ userId }: { userId: string }) {
  const { data, loading, error, reload } = useGroupData(userId);
  const [tab, setTab] = useState<Tab>("flats");

  if (loading) return <p className="p-6 text-slate-400">Loading your group…</p>;
  if (error) return <p className="p-6 text-red-400">{error}</p>;
  if (!data) return <CreateOrJoin onDone={reload} />;

  const needsPrefs = data.prefs[userId]?.max_rent_share == null;
  const TABS: { key: Tab; label: string }[] = [
    { key: "flats", label: `Flats (${data.listings.length})` },
    { key: "prefs", label: needsPrefs ? "My preferences •" : "My preferences" },
    { key: "shortlist", label: "★ Shortlist" },
    { key: "group", label: `Group (${data.members.length}/${GROUP_SIZE})` },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-50">{data.group.name}</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-800" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="mt-5">
        {tab === "flats" && <Flats data={data} userId={userId} goTo={setTab} />}
        {tab === "prefs" && <PreferencesForm data={data} userId={userId} />}
        {tab === "shortlist" && <Shortlist data={data} />}
        {tab === "group" && <GroupPanel data={data} userId={userId} onLeft={reload} />}
      </div>
    </main>
  );
}

function useRanked(data: GroupData) {
  return useMemo(() => {
    const memberIds = data.members.map((m) => m.user_id);
    const results = data.listings.map((l) => evaluateListing(l, memberIds, data.prefs, data.places, data.travelTimes, data.votes));
    return rankResults(results).map((r) => ({ result: r, listing: data.listings.find((l) => l.id === r.listingId)! }));
  }, [data]);
}

function SetupNotice({ data, userId, goTo }: { data: GroupData; userId: string; goTo: (t: Tab) => void }) {
  const missing = data.members.filter((m) => data.prefs[m.user_id]?.max_rent_share == null).length;
  if (data.members.length === GROUP_SIZE && missing === 0) return null;
  return (
    <div className="card border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
      <p className="font-semibold">Getting set up</p>
      <ul className="mt-1 list-disc pl-5">
        {data.members.length < GROUP_SIZE && (
          <li>
            {GROUP_SIZE - data.members.length} roommate(s) still need to join.{" "}
            <button className="underline" onClick={() => goTo("group")}>
              Get the invite link
            </button>
          </li>
        )}
        {data.prefs[userId]?.max_rent_share == null && (
          <li>
            You haven&apos;t filled in your preferences.{" "}
            <button className="underline" onClick={() => goTo("prefs")}>
              Do it now
            </button>
          </li>
        )}
        {missing > 0 && (
          <li>
            {missing} of {data.members.length} people still need to fill in preferences — match % only counts people who have.
          </li>
        )}
      </ul>
    </div>
  );
}

function Flats({ data, userId, goTo }: { data: GroupData; userId: string; goTo: (t: Tab) => void }) {
  const ranked = useRanked(data);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const best = ranked[0]?.result.match ?? null;
  const worksForAll = ranked.filter((r) => r.result.everyonePasses).length;
  const agreed = ranked.filter((r) => r.result.agreed).length;

  return (
    <div className="space-y-4">
      <SetupNotice data={data} userId={userId} goTo={goTo} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Flats added" value={String(data.listings.length)} />
        <Stat label="Best match" value={best === null ? "—" : `${best}%`} className={matchColor(best).text} />
        <Stat label="Work for all 3" value={String(worksForAll)} />
        <Stat label="Agreed shortlist" value={String(agreed)} />
      </div>

      {adding ? (
        <ListingForm
          groupId={data.group.id}
          userId={userId}
          onSaved={(id) => router.push(`/listings/${id}`)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Sorted from highest to lowest match across all 3 roommates.</p>
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Add a flat
          </button>
        </div>
      )}

      {ranked.length === 0 && !adding && (
        <div className="card text-center text-sm text-slate-400">
          No flats yet. Click <strong className="text-slate-200">+ Add a flat</strong> and paste a listing link to get started.
        </div>
      )}
      <div className="space-y-3">
        {ranked.map(({ listing, result }, i) => (
          <ListingCard key={listing.id} listing={listing} result={result} data={data} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function Shortlist({ data }: { data: GroupData }) {
  const agreed = useRanked(data).filter((r) => r.result.agreed);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Flats all 3 of you voted shortlist, that pass everyone&apos;s must-haves.</p>
      {agreed.length === 0 ? (
        <p className="card text-sm text-slate-400">Nothing yet. Open a flat and vote to add it here.</p>
      ) : (
        agreed.map(({ listing, result }, i) => <ListingCard key={listing.id} listing={listing} result={result} data={data} rank={i + 1} />)
      )}
    </div>
  );
}

function Stat({ label, value, className = "text-slate-50" }: { label: string; value: string; className?: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${className}`}>{value}</p>
    </div>
  );
}
