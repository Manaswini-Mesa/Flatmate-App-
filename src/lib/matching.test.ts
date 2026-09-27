// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateListing, evaluatePerson, rankResults } from "./matching.ts";
import type { Listing, Place, Preferences, TravelTime, Vote } from "./types.ts";

const G = "g1";

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: "l1", group_id: G, added_by: "riya", title: "3BHK Baner", area: "Baner", address: null,
    source_url: null, rent: 45000, deposit: 90000, bedrooms: 3, bathrooms: 2, floor: 2,
    has_lift: true, parking: true, pet_friendly: false, furnishing: "semi", sharing_allowed: true,
    maintenance: null, brokerage: null, non_veg_allowed: true, guests_allowed: true, no_curfew: true,
    gated_security: true, power_backup: true, washing_machine: false, air_conditioning: false, balcony: true,
    available_from: "2026-10-01", notes: null, created_at: "", updated_at: "",
    ...over,
  };
}

function prefs(user: string, over: Partial<Preferences> = {}): Preferences {
  return { group_id: G, user_id: user, max_rent_share: 16000, max_deposit_share: null, excluded_areas: [], criteria: {}, ...over };
}

const riyaGym: Place = { id: "p1", group_id: G, user_id: "riya", label: "Gym", max_minutes: 20, importance: "hard", weight: 3 };
const kavitaOffice: Place = { id: "p2", group_id: G, user_id: "kavita", label: "Hinjewadi office", max_minutes: 30, importance: "hard", weight: 3 };

test("budget splits rent + maintenance equally three ways", () => {
  const p = prefs("riya", { max_rent_share: 16000 });
  assert.equal(evaluatePerson("riya", listing({ rent: 48000 }), p, [], []).hardStatus, "pass");
  assert.equal(evaluatePerson("riya", listing({ rent: 45000, maintenance: 3000 }), p, [], []).hardStatus, "pass");
  assert.equal(evaluatePerson("riya", listing({ rent: 45000, maintenance: 3003 }), p, [], []).hardStatus, "fail");
});

test("upfront limit covers deposit + brokerage", () => {
  const p = prefs("riya", { max_deposit_share: 40000 });
  assert.equal(evaluatePerson("riya", listing({ deposit: 90000, brokerage: 30000 }), p, [], []).hardStatus, "pass");
  assert.equal(evaluatePerson("riya", listing({ deposit: 90000, brokerage: 45000 }), p, [], []).hardStatus, "fail");
});

test("excluded area fails the must-have", () => {
  const r = evaluatePerson("riya", listing({ area: "Kothrud" }), prefs("riya", { excluded_areas: ["Kothrud"] }), [], []);
  assert.equal(r.hardStatus, "fail");
});

test("Meera's lift rule: 5th floor with no lift fails, ground floor passes", () => {
  const p = prefs("meera", { criteria: { lift: { importance: "hard" } } });
  assert.equal(evaluatePerson("meera", listing({ floor: 5, has_lift: false }), p, [], []).hardStatus, "fail");
  assert.equal(evaluatePerson("meera", listing({ floor: 0, has_lift: false }), p, [], []).hardStatus, "pass");
  assert.equal(evaluatePerson("meera", listing({ floor: 3, has_lift: null }), p, [], []).hardStatus, "unknown");
});

test("house rules: veg-only flat fails a non-veg must-have", () => {
  const p = prefs("kavita", { criteria: { non_veg_allowed: { importance: "hard" }, guests_allowed: { importance: "nice", weight: 4 } } });
  assert.equal(evaluatePerson("kavita", listing({ non_veg_allowed: false }), p, [], []).hardStatus, "fail");
  const r = evaluatePerson("kavita", listing({ guests_allowed: false }), p, [], []);
  assert.equal(r.hardStatus, "pass");
  assert.deepEqual(r.compromises, ["Guests not allowed"]);
});

test("missing travel time is unknown, too long is fail", () => {
  const p = prefs("kavita");
  assert.equal(evaluatePerson("kavita", listing(), p, [kavitaOffice], []).hardStatus, "unknown");
  const tt: TravelTime[] = [{ listing_id: "l1", place_id: "p2", group_id: G, minutes: 45 }];
  assert.equal(evaluatePerson("kavita", listing(), p, [kavitaOffice], tt).hardStatus, "fail");
});

test("match % = points earned ÷ points possible (must-have = 5, nice = weight)", () => {
  const p = prefs("riya", {
    criteria: {
      parking: { importance: "nice", weight: 5 },
      pet_friendly: { importance: "nice", weight: 3 },
      min_bathrooms: { importance: "nice", weight: 2, value: 2 },
    },
  });
  // Must-haves: budget (5, pass) + area (5, pass). Nice: parking 5 pass, pets 3 fail, bathrooms 2 pass.
  // (5 + 5 + 5 + 2) / (5 + 5 + 5 + 3 + 2) = 17 / 20 = 85%
  const r = evaluatePerson("riya", listing(), p, [], []);
  assert.equal(r.match, 85);
  assert.deepEqual(r.compromises, ["No pets allowed"]);
});

test("agreed shortlist needs 3 members, all must-haves passing, and 3 shortlist votes", () => {
  const members = ["riya", "meera", "kavita"];
  const byUser = { riya: prefs("riya"), meera: prefs("meera"), kavita: prefs("kavita") };
  const tt: TravelTime[] = [
    { listing_id: "l1", place_id: "p1", group_id: G, minutes: 15 },
    { listing_id: "l1", place_id: "p2", group_id: G, minutes: 25 },
  ];
  const vote = (user: string, v: Vote["vote"]): Vote => ({ listing_id: "l1", user_id: user, group_id: G, vote: v });
  const allYes = [vote("riya", "shortlist"), vote("meera", "shortlist"), vote("kavita", "shortlist")];
  const places = [riyaGym, kavitaOffice];

  assert.equal(evaluateListing(listing(), members, byUser, places, tt, allYes).agreed, true);
  const oneDiscuss = [vote("riya", "shortlist"), vote("meera", "discuss"), vote("kavita", "shortlist")];
  assert.equal(evaluateListing(listing(), members, byUser, places, tt, oneDiscuss).agreed, false);
  // Everyone votes shortlist, but Kavita's commute is unknown → not agreed.
  assert.equal(evaluateListing(listing(), members, byUser, places, tt.slice(0, 1), allYes).agreed, false);
  // Only 2 members in the group → never agreed.
  assert.equal(evaluateListing(listing(), members.slice(0, 2), byUser, [riyaGym], tt, allYes).agreed, false);
});

test("flats are ranked from highest to lowest match %", () => {
  const members = ["riya"];
  const byUser = { riya: prefs("riya", { excluded_areas: ["Kothrud"], criteria: { balcony: { importance: "nice", weight: 5 } } }) };
  const best = evaluateListing(listing({ id: "a" }), members, byUser, [], [], []);
  const middle = evaluateListing(listing({ id: "b", balcony: false }), members, byUser, [], [], []);
  const worst = evaluateListing(listing({ id: "c", area: "Kothrud" }), members, byUser, [], [], []);
  assert.deepEqual(rankResults([worst, middle, best]).map((r) => r.listingId), ["a", "b", "c"]);
  assert.equal(best.match, 100);
});
