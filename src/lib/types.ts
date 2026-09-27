export type Importance = "hard" | "nice" | "none";
export type VoteValue = "shortlist" | "discuss" | "reject";
export type Furnishing = "unfurnished" | "semi" | "furnished";
export type Diet = "veg" | "eggetarian" | "non_veg";

export type CriterionSetting = {
  importance: Importance;
  weight?: number; // 1–5, only used when importance is "nice"
  value?: number | string; // e.g. minimum bathrooms, minimum furnishing, move-in date
};

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
};

export type Member = {
  group_id: string;
  user_id: string;
  joined_at: string;
};

export type Preferences = {
  group_id: string;
  user_id: string;
  max_rent_share: number | null;
  max_deposit_share: number | null;
  excluded_areas: string[];
  criteria: Record<string, CriterionSetting>;
  diet?: Diet | null;
  notes?: string | null;
  updated_at?: string;
};

export type Place = {
  id: string;
  group_id: string;
  user_id: string;
  label: string;
  max_minutes: number;
  importance: "hard" | "nice";
  weight: number;
};

export type Listing = {
  id: string;
  group_id: string;
  added_by: string | null;
  title: string;
  area: string;
  address: string | null;
  source_url: string | null;
  rent: number;
  deposit: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  has_lift: boolean | null;
  parking: boolean | null;
  pet_friendly: boolean | null;
  furnishing: Furnishing | null;
  sharing_allowed: boolean | null;
  maintenance: number | null;
  brokerage: number | null;
  non_veg_allowed: boolean | null;
  guests_allowed: boolean | null;
  no_curfew: boolean | null;
  gated_security: boolean | null;
  power_backup: boolean | null;
  washing_machine: boolean | null;
  air_conditioning: boolean | null;
  balcony: boolean | null;
  available_from: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelTime = {
  listing_id: string;
  place_id: string;
  group_id: string;
  minutes: number;
};

export type Vote = {
  listing_id: string;
  user_id: string;
  group_id: string;
  vote: VoteValue;
};

export type Comment = {
  id: string;
  listing_id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
};
