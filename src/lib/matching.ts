// Matching rules. Pure functions only — no database calls — so they are easy to test.
//
// For each flat and each roommate:
//   1. Hard checks (budget, excluded areas, must-have features, hard travel limits).
//      Each is pass / fail / unknown. A person "passes" only if every hard check passes.
//   2. Preference score = weight of nice-to-haves met ÷ total nice-to-have weight × 100.
//   3. Compromises = nice-to-haves the flat does not meet.
// A flat is on the agreed shortlist only when the group has exactly 3 members,
// all 3 pass every hard check, and all 3 voted "shortlist".

import type {
  CriterionSetting,
  Listing,
  Place,
  Preferences,
  TravelTime,
  Vote,
} from "./types.ts";

export type CheckStatus = "pass" | "fail" | "unknown";

export type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  hard: boolean;
  weight: number;
};

export type PersonResult = {
  userId: string;
  filledIn: boolean;
  hardStatus: CheckStatus;
  hardChecks: Check[];
  niceChecks: Check[];
  score: number; // 0–100
  gets: string[];
  compromises: string[];
  toCheck: string[];
};

export type ListingResult = {
  listingId: string;
  people: PersonResult[];
  hardFailCount: number;
  unknownCount: number;
  everyonePasses: boolean;
  averageScore: number;
  shortlistVotes: number;
  agreed: boolean;
};

export const GROUP_SIZE = 3;

const FURNISHING_RANK: Record<string, number> = { unfurnished: 0, semi: 1, furnished: 2 };
const FURNISHING_NAME: Record<string, string> = {
  unfurnished: "unfurnished",
  semi: "semi-furnished",
  furnished: "fully furnished",
};

type CriterionEval = { label: string; status: CheckStatus; detail: string };

export function rentShare(rent: number): number {
  return Math.ceil(rent / GROUP_SIZE);
}

function yesNo(value: boolean | null, label: string, noun: string): CriterionEval {
  if (value === null) return { label, status: "unknown", detail: `${noun}: not known yet` };
  return value
    ? { label, status: "pass", detail: `Has ${noun.toLowerCase()}` }
    : { label, status: "fail", detail: `No ${noun.toLowerCase()}` };
}

function evalCriterion(key: string, setting: CriterionSetting, l: Listing): CriterionEval | null {
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
    case "parking":
      return yesNo(l.parking, "Parking", "Parking");
    case "pet_friendly": {
      const label = "Pets allowed";
      if (l.pet_friendly === null) return { label, status: "unknown", detail: "Pet policy not known yet" };
      return l.pet_friendly
        ? { label, status: "pass", detail: "Pets allowed" }
        : { label, status: "fail", detail: "No pets allowed" };
    }
    case "sharing_allowed": {
      const label = "Flatmates allowed";
      if (l.sharing_allowed === null) return { label, status: "unknown", detail: "Landlord's flatmate policy not known yet" };
      return l.sharing_allowed
        ? { label, status: "pass", detail: "Landlord allows flatmates" }
        : { label, status: "fail", detail: "Landlord does not allow flatmates" };
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
        ? { label, status: "pass", detail: `${cap(FURNISHING_NAME[l.furnishing])}` }
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

  // Budget (always a hard rule): rent is split equally three ways.
  const share = rentShare(listing.rent);
  if (!filledIn) {
    hardChecks.push({
      key: "budget",
      label: "Budget",
      status: "unknown",
      detail: "Hasn't filled in preferences yet",
      hard: true,
      weight: 0,
    });
  } else {
    const max = prefs!.max_rent_share!;
    hardChecks.push({
      key: "budget",
      label: "Budget",
      status: share <= max ? "pass" : "fail",
      detail: share <= max
        ? `Rent share ₹${fmt(share)} (max ₹${fmt(max)})`
        : `Rent share ₹${fmt(share)} is over max ₹${fmt(max)}`,
      hard: true,
      weight: 0,
    });
  }

  if (prefs?.max_deposit_share) {
    const max = prefs.max_deposit_share;
    if (listing.deposit === null) {
      hardChecks.push({ key: "deposit", label: "Deposit", status: "unknown", detail: "Deposit not known yet", hard: true, weight: 0 });
    } else {
      const dShare = Math.ceil(listing.deposit / GROUP_SIZE);
      hardChecks.push({
        key: "deposit",
        label: "Deposit",
        status: dShare <= max ? "pass" : "fail",
        detail: dShare <= max
          ? `Deposit share ₹${fmt(dShare)} (max ₹${fmt(max)})`
          : `Deposit share ₹${fmt(dShare)} is over max ₹${fmt(max)}`,
        hard: true,
        weight: 0,
      });
    }
  }

  // Excluded areas (always hard).
  if (prefs) {
    const excluded = prefs.excluded_areas.some((a) => a.trim().toLowerCase() === listing.area.trim().toLowerCase());
    hardChecks.push({
      key: "area",
      label: "Area",
      status: excluded ? "fail" : "pass",
      detail: excluded ? `Won't live in ${listing.area}` : `${listing.area} is OK`,
      hard: true,
      weight: 0,
    });
  }

  // Flat features.
  for (const [key, setting] of Object.entries(prefs?.criteria ?? {})) {
    if (!setting || setting.importance === "none") continue;
    const result = evalCriterion(key, setting, listing);
    if (!result) continue;
    const hard = setting.importance === "hard";
    const check: Check = { key, ...result, hard, weight: hard ? 0 : clampWeight(setting.weight) };
    (hard ? hardChecks : niceChecks).push(check);
  }

  // Travel limits to each of this person's places.
  for (const place of places) {
    const tt = travelTimes.find((t) => t.place_id === place.id && t.listing_id === listing.id);
    const label = place.label;
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
    const check: Check = { key: `place:${place.id}`, label, status, detail, hard, weight: hard ? 0 : clampWeight(place.weight) };
    (hard ? hardChecks : niceChecks).push(check);
  }

  const totalWeight = niceChecks.reduce((s, c) => s + c.weight, 0);
  const metWeight = niceChecks.filter((c) => c.status === "pass").reduce((s, c) => s + c.weight, 0);
  const score = totalWeight === 0 ? 100 : Math.round((metWeight / totalWeight) * 100);

  return {
    userId,
    filledIn,
    hardStatus: worst(hardChecks.map((c) => c.status)),
    hardChecks,
    niceChecks,
    score,
    gets: niceChecks.filter((c) => c.status === "pass").map((c) => c.detail),
    compromises: niceChecks.filter((c) => c.status === "fail").map((c) => c.detail),
    toCheck: [...hardChecks, ...niceChecks].filter((c) => c.status === "unknown").map((c) => c.detail),
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
    evaluatePerson(
      uid,
      listing,
      prefsByUser[uid],
      places.filter((p) => p.user_id === uid),
      travelTimes,
    ),
  );
  const hardFailCount = people.reduce((s, p) => s + p.hardChecks.filter((c) => c.status === "fail").length, 0);
  const unknownCount = people.reduce((s, p) => s + p.hardChecks.filter((c) => c.status === "unknown").length, 0);
  const everyonePasses = memberIds.length === GROUP_SIZE && people.every((p) => p.hardStatus === "pass");
  const listingVotes = votes.filter((v) => v.listing_id === listing.id && memberIds.includes(v.user_id));
  const shortlistVotes = listingVotes.filter((v) => v.vote === "shortlist").length;
  const averageScore = people.length === 0 ? 0 : Math.round(people.reduce((s, p) => s + p.score, 0) / people.length);

  return {
    listingId: listing.id,
    people,
    hardFailCount,
    unknownCount,
    everyonePasses,
    averageScore,
    shortlistVotes,
    agreed: everyonePasses && shortlistVotes === GROUP_SIZE,
  };
}

// Best first: fewest hard failures, then fewest unknowns, then highest average score.
export function rankResults(results: ListingResult[]): ListingResult[] {
  return [...results].sort(
    (a, b) =>
      a.hardFailCount - b.hardFailCount ||
      a.unknownCount - b.unknownCount ||
      b.averageScore - a.averageScore,
  );
}

function clampWeight(w: number | undefined): number {
  const n = Math.round(Number(w ?? 3));
  return Math.min(5, Math.max(1, Number.isFinite(n) ? n : 3));
}

export function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}
