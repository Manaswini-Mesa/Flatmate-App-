import type { Listing } from "./types";

export const APP_NAME = "My Flattie";

export const PUNE_AREAS = [
  "Aundh",
  "Baner",
  "Balewadi",
  "Hinjewadi",
  "Kalyani Nagar",
  "Koregaon Park",
  "Kothrud",
  "Magarpatta",
  "Pashan",
  "Pimple Saudagar",
  "Viman Nagar",
  "Wakad",
];

// Yes/no things a flat either has or doesn't. `field` is the column on the listing.
export type YesNoFeature = {
  key: string;
  field: keyof Listing;
  label: string; // shown in the preferences form and the listing form
  short: string; // shown in results
  yes: string; // result text when the flat has it
  no: string; // result text when it doesn't
};

export const YES_NO_FEATURES: YesNoFeature[] = [
  { key: "parking", field: "parking", label: "Parking", short: "Parking", yes: "Has parking", no: "No parking" },
  { key: "gated_security", field: "gated_security", label: "Gated society / security", short: "Security", yes: "Gated with security", no: "No gated security" },
  { key: "power_backup", field: "power_backup", label: "Power backup", short: "Power backup", yes: "Has power backup", no: "No power backup" },
  { key: "balcony", field: "balcony", label: "Balcony", short: "Balcony", yes: "Has a balcony", no: "No balcony" },
  { key: "washing_machine", field: "washing_machine", label: "Washing machine", short: "Washing machine", yes: "Has a washing machine", no: "No washing machine" },
  { key: "air_conditioning", field: "air_conditioning", label: "Air conditioning", short: "AC", yes: "Has AC", no: "No AC" },
  { key: "sharing_allowed", field: "sharing_allowed", label: "Landlord allows flatmates / bachelors", short: "Flatmates allowed", yes: "Landlord allows flatmates", no: "Landlord does not allow flatmates" },
  { key: "non_veg_allowed", field: "non_veg_allowed", label: "Non-veg cooking allowed", short: "Non-veg OK", yes: "Non-veg cooking allowed", no: "Veg only — no non-veg cooking" },
  { key: "guests_allowed", field: "guests_allowed", label: "Guests allowed (incl. overnight)", short: "Guests OK", yes: "Guests allowed", no: "Guests not allowed" },
  { key: "no_curfew", field: "no_curfew", label: "No entry-time curfew", short: "No curfew", yes: "No curfew", no: "Has an entry-time curfew" },
  { key: "pet_friendly", field: "pet_friendly", label: "Pets allowed", short: "Pets allowed", yes: "Pets allowed", no: "No pets allowed" },
];

export type CriterionKind = "boolean" | "number" | "furnishing" | "date" | "lift";

export type CriterionDef = {
  key: string;
  label: string;
  kind: CriterionKind;
  section: string;
  defaultValue?: number | string;
};

const yesNo = (key: string, section: string): CriterionDef => ({
  key,
  label: YES_NO_FEATURES.find((f) => f.key === key)!.label,
  kind: "boolean",
  section,
});

// Everything a roommate can mark as must-have, nice-to-have, or don't care — grouped for the form.
export const CRITERIA: CriterionDef[] = [
  { key: "min_bedrooms", label: "Minimum bedrooms (BHK)", kind: "number", section: "Size & layout", defaultValue: 3 },
  { key: "min_bathrooms", label: "Minimum bathrooms", kind: "number", section: "Size & layout", defaultValue: 2 },
  { key: "furnishing", label: "Minimum furnishing", kind: "furnishing", section: "Size & layout", defaultValue: "semi" },
  yesNo("balcony", "Size & layout"),
  { key: "lift", label: "Lift (if the flat is above the ground floor)", kind: "lift", section: "Building" },
  yesNo("parking", "Building"),
  yesNo("gated_security", "Building"),
  yesNo("power_backup", "Building"),
  yesNo("washing_machine", "Amenities"),
  yesNo("air_conditioning", "Amenities"),
  yesNo("sharing_allowed", "House rules"),
  yesNo("non_veg_allowed", "House rules"),
  yesNo("guests_allowed", "House rules"),
  yesNo("no_curfew", "House rules"),
  yesNo("pet_friendly", "House rules"),
  { key: "move_in_by", label: "Available to move in by", kind: "date", section: "Timing" },
];

export const CRITERIA_SECTIONS = Array.from(new Set(CRITERIA.map((c) => c.section)));

export const FURNISHING_LABELS: Record<string, string> = {
  unfurnished: "Unfurnished",
  semi: "Semi-furnished",
  furnished: "Fully furnished",
};

export const DIET_LABELS: Record<string, string> = {
  veg: "Vegetarian",
  eggetarian: "Eggetarian",
  non_veg: "Non-vegetarian",
};

export const VOTE_LABELS = {
  shortlist: "Shortlist",
  discuss: "Discuss",
  reject: "Reject",
} as const;

// "https://www.99acres.com/abc" → "99acres.com"
export function siteName(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
