"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateOrJoin } from "@/components/CreateOrJoin";
import { GroupPanel } from "@/components/GroupPanel";
import { ListingForm } from "@/components/ListingForm";
import { PreferencesForm } from "@/components/PreferencesForm";
import { RequireAuth } from "@/components/RequireAuth";
import { ListingCard } from "@/components/Results";
import { evaluateListing, GROUP_SIZE, rankResults } from "@/lib/matching";
import { useGroupData, type GroupData } from "@/lib/useGroupData";

type Tab = "overview" | "flats" | "prefs" | "group";

export default function DashboardPage() {
  return <RequireAuth>{(session) => <Dashboard userId={session.user.id} />}</RequireAuth>;
}

function Dashboard({ userId }: { userId: string }) {
  const { data, loading, error, reload } = useGroupData(userId);
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) return <p className="p-6 text-slate-500">Loading your group…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!data) return <CreateOrJoin onDone={reload} />;

  const needsPrefs = data.prefs[userId]?.max_rent_share == null;
  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "flats", label: `Flats (${data.listings.length})` },
    { key: "prefs", label: needsPrefs ? "My preferences •" : "My preferences" },
    { key: "group", label: `Group (${data.members.length}/${GROUP_SIZE})` },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">{data.group.name}</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="mt-5">
        {tab === "overview" && <Overview data={data} userId={userId} goTo={setTab} />}
        {tab === "flats" && <Flats data={data} userId={userId} />}
        {tab === "prefs" && <PreferencesForm data={data} userId={userId} />}
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

function Overview({ data, userId, goTo }: { data: GroupData; userId: string; goTo: (t: Tab) => void }) {
  const ranked = useRanked(data);
  const agreed = ranked.filter((r) => r.result.agreed);
  const topPicks = ranked.filter((r) => !r.result.agreed && r.result.hardFailCount === 0).slice(0, 3);
  const missing = data.members.filter((m) => data.prefs[m.user_id]?.max_rent_share == null).length;

  return (
    <div className="space-y-6">
      {(data.members.length < GROUP_SIZE || missing > 0) && (
        <div className="card border-amber-200 bg-amber-50 text-sm">
          <p className="font-semibold text-amber-900">Getting set up</p>
          <ul className="mt-1 list-disc pl-5 text-amber-900">
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
            {missing > 0 && <li>{missing} of {data.members.length} people still need to fill in preferences.</li>}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">★ Agreed shortlist</h2>
        <p className="text-sm text-slate-500">All 3 voted shortlist and every must-have passes for everyone.</p>
        <div className="mt-3 space-y-3">
          {agreed.length === 0 ? (
            <p className="card text-sm text-slate-500">Nothing yet.</p>
          ) : (
            agreed.map(({ listing, result }) => <ListingCard key={listing.id} listing={listing} result={result} data={data} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Best options to discuss</h2>
        <p className="text-sm text-slate-500">
          Up to 3 flats with no deal-breakers for anyone, ranked by fewest open questions, then highest average score.
        </p>
        <div className="mt-3 space-y-3">
          {topPicks.length === 0 ? (
            <p className="card text-sm text-slate-500">
              {data.listings.length === 0 ? "Add your first flat in the Flats tab." : "No flat passes everyone's must-haves yet."}
            </p>
          ) : (
            topPicks.map(({ listing, result }) => <ListingCard key={listing.id} listing={listing} result={result} data={data} />)
          )}
        </div>
      </section>
    </div>
  );
}

function Flats({ data, userId }: { data: GroupData; userId: string }) {
  const ranked = useRanked(data);
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      {adding ? (
        <ListingForm
          groupId={data.group.id}
          userId={userId}
          onSaved={(id) => router.push(`/listings/${id}`)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Add a flat
        </button>
      )}
      {ranked.length === 0 && !adding && <p className="card text-sm text-slate-500">No flats yet.</p>}
      {ranked.map(({ listing, result }) => (
        <ListingCard key={listing.id} listing={listing} result={result} data={data} />
      ))}
    </div>
  );
}
