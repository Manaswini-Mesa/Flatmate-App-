// Turns a property listing link (and, when the site allows it, the page's HTML) into flat details.
// Pure functions only — the actual download happens in src/app/api/analyze/route.ts.
//
// Sources, from most to least reliable:
//   1. NoBroker's own listing data embedded in the page (nb.appState)
//   2. schema.org JSON-LD blocks that many sites include for search engines
//   3. The page's title / preview text (og:title, og:description)
//   4. The link itself — most portals put BHK, area and rent in the URL
// Anything none of these mention stays null and shows as "Needs checking".

import type { Furnishing, Listing } from "./types.ts";

export type ImportedFields = Partial<
  Pick<
    Listing,
    | "title" | "area" | "address" | "rent" | "maintenance" | "deposit" | "brokerage" | "bedrooms" | "bathrooms"
    | "floor" | "has_lift" | "parking" | "pet_friendly" | "furnishing" | "sharing_allowed" | "non_veg_allowed"
    | "guests_allowed" | "no_curfew" | "gated_security" | "power_backup" | "washing_machine" | "air_conditioning"
    | "balcony" | "available_from" | "latitude" | "longitude" | "image_url" | "notes"
  >
>;

// Areas we can recognise in a title or link. Aliases map other spellings to the name used in preferences.
const AREA_NAMES: Record<string, string> = {
  aundh: "Aundh", baner: "Baner", balewadi: "Balewadi", hinjewadi: "Hinjewadi", hinjawadi: "Hinjewadi",
  "kalyani nagar": "Kalyani Nagar", "koregaon park": "Koregaon Park", kothrud: "Kothrud", magarpatta: "Magarpatta",
  pashan: "Pashan", "pimple saudagar": "Pimple Saudagar", "viman nagar": "Viman Nagar", wakad: "Wakad",
  kharadi: "Kharadi", hadapsar: "Hadapsar", wagholi: "Wagholi", bavdhan: "Bavdhan", warje: "Warje",
  "karve nagar": "Karve Nagar", "shivaji nagar": "Shivaji Nagar", shivajinagar: "Shivaji Nagar", deccan: "Deccan",
  kondhwa: "Kondhwa", undri: "Undri", nibm: "NIBM", ravet: "Ravet", punawale: "Punawale", tathawade: "Tathawade",
  "pimple nilakh": "Pimple Nilakh", "pimple gurav": "Pimple Gurav", thergaon: "Thergaon", pimpri: "Pimpri",
  chinchwad: "Chinchwad", sus: "Sus", mahalunge: "Mahalunge", yerawada: "Yerawada", wanowrie: "Wanowrie",
  "sinhagad road": "Sinhagad Road", katraj: "Katraj", dhanori: "Dhanori", lohegaon: "Lohegaon",
  "model colony": "Model Colony", "erandwane": "Erandwane", "camp": "Camp", "bibwewadi": "Bibwewadi",
};

export function detectArea(text: string): string | null {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  let best: { at: number; name: string } | null = null;
  for (const [key, name] of Object.entries(AREA_NAMES)) {
    const at = hay.indexOf(` ${key} `);
    if (at >= 0 && (!best || at < best.at)) best = { at, name };
  }
  return best?.name ?? null;
}

const toInt = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

// ── 4. The link itself ──────────────────────────────────────────────────────────
export function fromUrl(url: string): ImportedFields {
  let path: string;
  try {
    const u = new URL(url);
    path = decodeURIComponent(u.pathname + " " + u.search).toLowerCase().replace(/[_+&=?/]/g, "-");
  } catch {
    return {};
  }
  const out: ImportedFields = {};
  const bhk = path.match(/(\d)-?bhk/);
  if (bhk) out.bedrooms = Number(bhk[1]);
  else if (/\d-?rk/.test(path)) out.bedrooms = 1;
  const rent = path.match(/(?:for-rs|rs|inr|rent-for|price)-?(\d{4,7})(?!\d)/);
  if (rent) out.rent = Number(rent[1]);
  const area = detectArea(path.replace(/-/g, " "));
  if (area) out.area = area;
  if (/nobroker\./.test(url)) out.brokerage = 0;
  return out;
}

// ── 3. Title and preview text ───────────────────────────────────────────────────
export function fromText(text: string): ImportedFields {
  const out: ImportedFields = {};
  const t = text.replace(/\s+/g, " ");
  const bhk = t.match(/(\d)\s*-?\s*BHK/i);
  if (bhk) out.bedrooms = Number(bhk[1]);
  else if (/\b\d\s*RK\b/i.test(t)) out.bedrooms = 1;
  const rent = t.match(/(?:Rs\.?|₹|INR)\s*([\d,]{4,9})/i);
  if (rent && /rent/i.test(t)) out.rent = toInt(rent[1]) ?? undefined;
  if (/semi[\s-]?furnished/i.test(t)) out.furnishing = "semi";
  else if (/\b(un[\s-]?furnished|not furnished)\b/i.test(t)) out.furnishing = "unfurnished";
  else if (/\b(fully[\s-]?|full[\s-]?)?furnished\b/i.test(t)) out.furnishing = "furnished";
  if (/(without|no|zero)\s+broker(age)?|brokerage[\s-]free/i.test(t)) out.brokerage = 0;
  if (/\b(lift|elevator)\b/i.test(t) && !/\bno (lift|elevator)\b/i.test(t)) out.has_lift = true;
  if (/\bpet[\s-]?friendly\b|pets? allowed/i.test(t)) out.pet_friendly = true;
  if (/\bgated\b/i.test(t)) out.gated_security = true;
  if (/\bbachelors?\b/i.test(t) && !/\bno bachelors?\b/i.test(t)) out.sharing_allowed = true;
  if (/\b(veg(etarian)?s? only|only veg(etarian)?s?)\b/i.test(t)) out.non_veg_allowed = false;
  const area = detectArea(t);
  if (area) out.area = area;
  return out;
}

// ── 2. schema.org JSON-LD ───────────────────────────────────────────────────────
type Json = Record<string, unknown>;

function ldObjects(html: string): Json[] {
  const out: Json[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const o = stack.pop();
        if (!o || typeof o !== "object") continue;
        out.push(o as Json);
        const graph = (o as Json)["@graph"];
        if (Array.isArray(graph)) stack.push(...graph);
      }
    } catch {
      // ignore broken blocks
    }
  }
  return out;
}

export function fromJsonLd(html: string): ImportedFields {
  const out: ImportedFields = {};
  for (const o of ldObjects(html)) {
    const type = String(o["@type"] ?? "");
    if (/WebSite|Organization|BreadcrumbList|SearchAction|WebPage/i.test(type)) continue;
    const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Json | undefined;
    const price = toInt(String(offers?.price ?? ""));
    if (price && price >= 2000 && price <= 1000000) out.rent ??= price;
    const rooms = toInt(String(o.numberOfBedrooms ?? o.numberOfRooms ?? ""));
    if (rooms && rooms <= 10) out.bedrooms ??= rooms;
    const baths = toInt(String(o.numberOfBathroomsTotal ?? o.numberOfFullBathrooms ?? ""));
    if (baths && baths <= 10) out.bathrooms ??= baths;
    const address = o.address as Json | undefined;
    if (address && typeof address === "object") {
      const locality = String(address.addressLocality ?? "");
      const street = String(address.streetAddress ?? "");
      out.area ??= detectArea(`${street} ${locality}`) ?? undefined;
      if (street) out.address ??= street;
    }
    const geo = o.geo as Json | undefined;
    const lat = Number(geo?.latitude);
    const lng = Number(geo?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      out.latitude ??= lat;
      out.longitude ??= lng;
    }
    if (typeof o.name === "string" && /bhk|rent|flat|apartment|house/i.test(o.name)) out.title ??= o.name;
    const img = Array.isArray(o.image) ? o.image[0] : o.image;
    const imgUrl = typeof img === "string" ? img : (img as Json | undefined)?.url;
    if (typeof imgUrl === "string" && /^https?:\/\//.test(imgUrl)) out.image_url ??= imgUrl;
  }
  return out;
}

// ── 1. NoBroker's embedded listing data ─────────────────────────────────────────
function readJsonObject(text: string, start: number): unknown {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  return null;
}

const NB_FURNISHING: Record<string, Furnishing> = {
  FULLY_FURNISHED: "furnished",
  SEMI_FURNISHED: "semi",
  NOT_FURNISHED: "unfurnished",
};

const NB_TENANTS: Record<string, string> = {
  ANYONE: "Anyone",
  FAMILY: "Family",
  COMPANY: "Company",
  BACHELOR: "Bachelors",
  BACHELOR_MALE: "Bachelors (male)",
  BACHELOR_FEMALE: "Bachelors (female)",
};

export function fromNoBroker(html: string): ImportedFields {
  const at = html.indexOf("nb.appState");
  if (at < 0) return {};
  const brace = html.indexOf("{", at);
  let d: Json | undefined;
  try {
    const state = readJsonObject(html, brace) as Json | null;
    d = (state?.propertyDetails as Json | undefined)?.detailsData as Json | undefined;
  } catch {
    return {};
  }
  if (!d || typeof d !== "object") return {};

  let amen: Record<string, boolean> = {};
  try {
    amen = typeof d.amenities === "string" ? JSON.parse(d.amenities) : ((d.amenities as Record<string, boolean>) ?? {});
  } catch {
    // leave empty
  }
  const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
  const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  const out: ImportedFields = { brokerage: 0 };
  out.title = String(d.propertyTitle || d.title || "").replace(/\s+/g, " ").trim() || undefined;
  out.area = detectArea(String(d.nbLocality ?? "")) ?? ((d.nbLocality as string) || (d.locality as string) || undefined);
  out.address = (d.address as string) || undefined;
  out.rent = num(d.rent);
  out.deposit = num(d.deposit);
  out.maintenance = num(d.maintenanceAmount) ?? (d.maintenance === false ? 0 : undefined);
  const bhk = String(d.type ?? "").match(/BHK(\d)/);
  if (bhk) out.bedrooms = Number(bhk[1]);
  else if (/RK/.test(String(d.type ?? ""))) out.bedrooms = 1;
  out.bathrooms = num(d.bathroom);
  out.floor = num(d.floor);
  out.has_lift = bool(d.lift) ?? bool(amen.LIFT);
  if (typeof d.parking === "string") out.parking = d.parking !== "NONE";
  out.furnishing = NB_FURNISHING[String(d.furnishing)] ?? undefined;
  out.gated_security = bool(amen.SECURITY);
  out.power_backup = bool(amen.PB);
  out.air_conditioning = bool(amen.AC);
  if (typeof d.balconies === "number") out.balcony = d.balconies > 0;
  const tenants = (Array.isArray(d.leaseTypeNew) ? d.leaseTypeNew : [d.leaseType]).filter(Boolean).map(String);
  if (tenants.length) out.sharing_allowed = tenants.some((x) => x === "ANYONE" || x.startsWith("BACHELOR"));
  if (typeof d.availableFrom === "number") {
    out.available_from = new Date(d.availableFrom + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST date
  }
  out.latitude = num(d.latitude);
  out.longitude = num(d.longitude);
  const notes = [
    tenants.length ? `Tenant preference on NoBroker: ${tenants.map((x) => NB_TENANTS[x] ?? x).join(", ")}` : "",
    typeof d.totalFloor === "number" ? `Building has ${d.totalFloor} floors` : "",
    typeof d.propertySize === "number" ? `${d.propertySize} sq ft` : "",
  ].filter(Boolean);
  if (notes.length) out.notes = notes.join(" · ");
  return out;
}

// ── Putting it together ─────────────────────────────────────────────────────────
function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i");
  const m = html.match(re) ?? html.match(re2);
  return m ? decodeEntities(m[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8377;/g, "₹");
}

function cleanTitle(t: string): string {
  return t.split(" | ")[0].trim().slice(0, 120); // drop the " | SiteName" suffix
}

// Later sources only fill gaps left by earlier (more reliable) ones.
function fillGaps(target: ImportedFields, source: ImportedFields) {
  for (const [k, v] of Object.entries(source)) {
    const key = k as keyof ImportedFields;
    if (v !== undefined && v !== null && (target[key] === undefined || target[key] === null)) {
      (target as Record<string, unknown>)[key] = v;
    }
  }
}

export function extractListing(url: string, html: string | null): ImportedFields {
  const out: ImportedFields = {};
  if (html) {
    fillGaps(out, fromNoBroker(html));
    fillGaps(out, fromJsonLd(html));
    const title = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const desc = meta(html, "og:description") ?? meta(html, "description") ?? "";
    fillGaps(out, fromText(`${decodeEntities(title)} ${desc}`));
    if (title && !out.title) out.title = cleanTitle(decodeEntities(title));
    const img = meta(html, "og:image");
    if (img && /^https?:\/\//.test(img)) fillGaps(out, { image_url: img });
  }
  fillGaps(out, fromUrl(url));
  if (!out.title) out.title = fallbackTitle(url, out);
  return out;
}

function fallbackTitle(url: string, f: ImportedFields): string {
  let site = "listing";
  try {
    site = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep default
  }
  const parts = [f.bedrooms ? `${f.bedrooms} BHK` : "Flat", f.area ? `in ${f.area}` : "", `(${site})`];
  return parts.filter(Boolean).join(" ");
}

// The details that matter most for matching — used to tell people what couldn't be found.
export const KEY_FIELDS: { key: keyof ImportedFields; label: string }[] = [
  { key: "rent", label: "rent" },
  { key: "area", label: "area" },
  { key: "bedrooms", label: "bedrooms" },
  { key: "bathrooms", label: "bathrooms" },
  { key: "deposit", label: "deposit" },
  { key: "floor", label: "floor" },
  { key: "has_lift", label: "lift" },
  { key: "parking", label: "parking" },
  { key: "furnishing", label: "furnishing" },
  { key: "sharing_allowed", label: "flatmates allowed" },
  { key: "non_veg_allowed", label: "non-veg cooking" },
  { key: "guests_allowed", label: "guests" },
  { key: "pet_friendly", label: "pets" },
];
