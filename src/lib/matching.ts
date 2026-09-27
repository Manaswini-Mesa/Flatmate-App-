// Matching rules. Pure functions only — no database calls — so they are easy to test.
//
// For each flat and each roommate we run a list of checks. Each check is pass / fail / unknown:
//   • Must-haves: budget, upfront costs, excluded areas, must-have features, must-have travel limits.
//   • Nice-to-haves: features and travel limits marked "nice to have", each with a weight 1–5.
//
// Match % for one person = points earned ÷ points possible.
//   A must-have is worth MUST_HAVE_POINTS; a nice-to-have is worth its weight. Only a "pass" earns points
//   (unknown earns nothing, so filling in missing details can only raise the score).
// Match % for the flat = average of the roommates who have filled in their preferences.
// Flats are listed from highest to lowest match %.
//
// A flat is on the agreed shortlist only when the group has exactly 3 members,
// all 3 pass every must-have, and all 3 voted "shortlist".

import { YES_NO_FEATURES } from "./constants.ts";
import type { CriterionSetting, Listing, Place, Preferences, TravelTime, Vote } from "./types.ts";

export type CheckStatus = "pass" | "fail" | "unknown";

export type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  hard: boolean;
  points: number;
};

export type PersonResult = {
  userId: string;
  filledIn: boolean;
  hardStatus: CheckStatus;
  hardChecks: Check[];
  niceChecks: Check[];
  match: number; // 0–100
  gets: string[];
  compromises: string[];
  toCheck: string[];
};

export type ListingResult = {
  listingId: string;
  people: PersonResult[];
  match: number | null; // 0–100, null when nobody has filled in preferences
  hardFailCount: number;
  unknownCount: number;
  everyonePasses: boolean;
  shortlistVotes: number;
  agreed: boolean;
};

export const GROUP_SIZE = 3;
export const MUST_HAVE_POINTS = 5;

const FURNISHING_RANK: Record<string, number> = { unfurnished: 0, semi: 1, furnished: 2 };
const FURNISHING_NAME: Record<string, string> = {
  unfurnished: "unfurnished",
  semi: "semi-furnished",
  furnished: "fully furnished",
};

type CriterionEval = { label: string; status: CheckStatus; detail: string };

// Monthly cost per person: rent + maintenance, split equally.
export function rentShare(l: Pick<Listing, "rent" | "maintenance">): number {
  return Math.ceil((l.rent + (l.maintenance ?? 0)) / GROUP_SIZE);
}

// One-time cost per person: deposit + brokerage, split equally. Null if the deposit isn't known.
export function upfrontShare(l: Pick<Listing, "deposit" | "brokerage">): number | null {
  if (l.deposit === null) return null;
  return Math.ceil((l.deposit + (l.brokerage ?? 0)) / GROUP_SIZE);
}

function evalCriterion(key: string, setting: CriterionSetting, l: Listing): CriterionEval | null {
  const feature = YES_NO_FEATURES.find((f) => f.key === key);
  if (feature) {
    const value = l[feature.field] as boolean | null;
    if (value === null) return { label: feature.short, status: "unknown", detail: `${feature.short}: not known yet` };
    return value
      ? { label: feature.short, status: "pass", detail: feature.yes }
      : { label: feature.short, status: "fail", detail: feature.no };
  }

  switch (key) {
    case "lift": {
      const label = "Lift";
      if (l.floor === null) return { label, status: "unknown", detail: "Floor not known yet" };
      if (l.floor <= 0) return { label, status: "pass", detail: "Ground floor — no lift needed" };
      if (l.has_lift === null) return { label, status: "unknown", detail: `Floor ${l.floor}, lift not known yet` };
      return l.has_lift
        ? { label, status: "pass", detail: `Floor ${l.floor} with a lift` }
        : { label, status: "fail", detail: `Floor ${l.floor} with no lift` };
    }
    case "min_bathrooms":
    case "min_bedrooms": {
      const isBath = key === "min_bathrooms";
      const label = isBath ? "Bathrooms" : "Bedrooms";
      const want = Number(setting.value ?? (isBath ? 2 : 3));
      const have = isBath ? l.bathrooms : l.bedrooms;
      const noun = isBath ? "bathroom" : "bedroom";
      if (have === null) return { label, status: "unknown", detail: `Number of ${noun}s not known yet` };
      return have >= want
        ? { label, status: "pass", detail: `${have} ${noun}${have === 1 ? "" : "s"} (wanted ${want}+)` }
        : { label, status: "fail", detail: `Only ${have} ${noun}${have === 1 ? "" : "s"} (wanted ${want}+)` };
    }
    case "furnishing": {
      const label = "Furnishing";
      const want = String(setting.value ?? "semi");
      if (l.furnishing === null) return { label, status: "unknown", detail: "Furnishing not known yet" };
      return FURNISHING_RANK[l.furnishing] >= FURNISHING_RANK[want]
        ? { label, status: "pass", detail: cap(FURNISHING_NAME[l.furnishing]) }
        : { label, status: "fail", detail: `${cap(FURNISHING_NAME[l.furnishing])} (wanted ${FURNISHING_NAME[want]})` };
    }
    case "move_in_by": {
      const label = "Move-in date";
      if (!setting.value) return null; // no date chosen → nothing to check
      const want = String(setting.value);
      if (!l.available_from) return { label, status: "unknown", detail: "Available-from date not known yet" };
      return l.available_from <= want
        ? { label, status: "pass", detail: `Available from ${l.available_from}` }
        : { label, status: "fail", detail: `Only available from ${l.available_from} (needed by ${want})` };
    }
    default:
      return null;
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function worst(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("unknown")) return "unknown";
  return "pass";
}

function mustHave(key: string, label: string, status: CheckStatus, detail: string): Check {
  return { key, label, status, detail, hard: true, points: MUST_HAVE_POINTS };
}

export function evaluatePerson(
  userId: string,
  listing: Listing,
  prefs: Preferences | undefined,
  places: Place[],
  travelTimes: TravelTime[],
): PersonResult {
  const hardChecks: Check[] = [];
  const niceChecks: Check[] = [];
  const filledIn = !!prefs && prefs.max_rent_share !== null;

  // Budget (always a must-have): rent + maintenance, split equally three ways.
  const share = rentShare(listing);
  if (!filledIn) {
    hardChecks.push(mustHave("budget", "Budget", "unknown", "Hasn't filled in preferences yet"));
  } else {
    const max = prefs!.max_rent_share!;
    const incl = listing.maintenance ? " incl. maintenance" : "";
    hardChecks.push(
      share <= max
        ? mustHave("budget", "Budget", "pass", `₹${fmt(share)}/mo each${incl} (max ₹${fmt(max)})`)
        : mustHave("budget", "Budget", "fail", `₹${fmt(share)}/mo each${incl} is over max ₹${fmt(max)}`),
    );
  }

  // Upfront costs (must-have if the person set a limit): deposit + brokerage.
  if (prefs?.max_deposit_share) {
    const max = prefs.max_deposit_share;
    const up = upfrontShare(listing);
    hardChecks.push(
      up === null
        ? mustHave("upfront", "Upfront cost", "unknown", "Deposit not known yet")
        : up <= max
          ? mustHave("upfront", "Upfront cost", "pass", `₹${fmt(up)} each upfront (max ₹${fmt(max)})`)
          : mustHave("upfront", "Upfront cost", "fail", `₹${fmt(up)} each upfront is over max ₹${fmt(max)}`),
    );
  }

  // Excluded areas (always a must-have).
  if (prefs) {
    const excluded = prefs.excluded_areas.some((a) => a.trim().toLowerCase() === listing.area.trim().toLowerCase());
    hardChecks.push(
      excluded
        ? mustHave("area", "Area", "fail", `Won't live in ${listing.area}`)
        : mustHave("area", "Area", "pass", `${listing.area} is OK`),
    );
  }

  // Flat features and house rules.
  for (const [key, setting] of Object.entries(prefs?.criteria ?? {})) {
    if (!setting || setting.importance === "none") continue;
    const result = evalCriterion(key, setting, listing);
    if (!result) continue;
    const hard = setting.importance === "hard";
    const check: Check = { key, ...result, hard, points: hard ? MUST_HAVE_POINTS : clampWeight(setting.weight) };
    (hard ? hardChecks : niceChecks).push(check);
  }

  // Travel limits to each of this person's places.
  for (const place of places) {
    const tt = travelTimes.find((t) => t.place_id === place.id && t.listing_id === listing.id);
    let status: CheckStatus;
    let detail: string;
    if (!tt) {
      status = "unknown";
      detail = `Travel time to ${place.label} not entered yet (max ${place.max_minutes} min)`;
    } else if (tt.minutes <= place.max_minutes) {
      status = "pass";
      detail = `${tt.minutes} min to ${place.label} (max ${place.max_minutes})`;
    } else {
      status = "fail";
      detail = `${tt.minutes} min to ${place.label} — over the ${place.max_minutes} min limit`;
    }
    const hard = place.importance === "hard";
    const check: Check = { key: `place:${place.id}`, label: place.label, status, detail, hard, points: hard ? MUST_HAVE_POINTS : clampWeight(place.weight) };
    (hard ? hardChecks : niceChecks).push(check);
  }

  const all = [...hardChecks, ...niceChecks];
  const possible = all.reduce((s, c) => s + c.points, 0);
  const earned = all.filter((c) => c.status === "pass").reduce((s, c) => s + c.points, 0);

  return {
    userId,
    filledIn,
    hardStatus: worst(hardChecks.map((c) => c.status)),
    hardChecks,
    niceChecks,
    match: filledIn ? (possible === 0 ? 100 : Math.round((earned / possible) * 100)) : 0,
    gets: niceChecks.filter((c) => c.status === "pass").map((c) => c.detail),
    compromises: niceChecks.filter((c) => c.status === "fail").map((c) => c.detail),
    toCheck: all.filter((c) => c.status === "unknown").map((c) => c.detail),
  };
}

export function evaluateListing(
  listing: Listing,
  memberIds: string[],
  prefsByUser: Record<string, Preferences | undefined>,
  places: Place[],
  travelTimes: TravelTime[],
  votes: Vote[],
): ListingResult {
  const people = memberIds.map((uid) =>
    evaluatePerson(uid, listing, prefsByUser[uid], places.filter((p) => p.user_id === uid), travelTimes),
  );
  const filled = people.filter((p) => p.filledIn);
  const hardFailCount = people.reduce((s, p) => s + p.hardChecks.filter((c) => c.status === "fail").length, 0);
  const unknownCount = people.reduce((s, p) => s + p.hardChecks.filter((c) => c.status === "unknown").length, 0);
  const everyonePasses = memberIds.length === GROUP_SIZE && people.every((p) => p.hardStatus === "pass");
  const shortlistVotes = votes.filter(
    (v) => v.listing_id === listing.id && memberIds.includes(v.user_id) && v.vote === "shortlist",
  ).length;

  return {
    listingId: listing.id,
    people,
    match: filled.length === 0 ? null : Math.round(filled.reduce((s, p) => s + p.match, 0) / filled.length),
    hardFailCount,
    unknownCount,
    everyonePasses,
    shortlistVotes,
    agreed: everyonePasses && shortlistVotes === GROUP_SIZE,
  };
}

// Highest match % first. Ties: fewer deal-breakers first.
export function rankResults(results: ListingResult[]): ListingResult[] {
  return [...results].sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || a.hardFailCount - b.hardFailCount);
}

function clampWeight(w: number | undefined): number {
  const n = Math.round(Number(w ?? 3));
  return Math.min(5, Math.max(1, Number.isFinite(n) ? n : 3));
}

export function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}
