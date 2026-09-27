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

export type CriterionKind = "boolean" | "number" | "furnishing" | "date";

export type CriterionDef = {
  key: string;
  label: string; // shown in the form
  short: string; // shown in results, e.g. "Lift"
  kind: CriterionKind;
  help?: string;
  defaultValue?: number | string;
};

// The flat features each roommate can mark as must-have, nice-to-have, or don't care.
export const CRITERIA: CriterionDef[] = [
  { key: "lift", label: "Lift (if the flat is above the ground floor)", short: "Lift", kind: "boolean" },
  { key: "parking", label: "Parking", short: "Parking", kind: "boolean" },
  { key: "min_bathrooms", label: "Minimum bathrooms", short: "Bathrooms", kind: "number", defaultValue: 2 },
  { key: "min_bedrooms", label: "Minimum bedrooms (BHK)", short: "Bedrooms", kind: "number", defaultValue: 3 },
  { key: "pet_friendly", label: "Pet-friendly", short: "Pets allowed", kind: "boolean" },
  { key: "furnishing", label: "Minimum furnishing", short: "Furnishing", kind: "furnishing", defaultValue: "semi" },
  {
    key: "sharing_allowed",
    label: "Landlord allows flatmates / bachelors",
    short: "Flatmates allowed",
    kind: "boolean",
  },
  { key: "move_in_by", label: "Available to move in by", short: "Move-in date", kind: "date" },
];

export const FURNISHING_LABELS: Record<string, string> = {
  unfurnished: "Unfurnished",
  semi: "Semi-furnished",
  furnished: "Fully furnished",
};

export const VOTE_LABELS = {
  shortlist: "Shortlist",
  discuss: "Discuss",
  reject: "Reject",
} as const;
