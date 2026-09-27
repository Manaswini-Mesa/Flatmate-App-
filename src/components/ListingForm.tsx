"use client";

import { useState } from "react";
import { PUNE_AREAS } from "@/lib/constants";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Listing } from "@/lib/types";

type Tri = "" | "yes" | "no";

const toTri = (b: boolean | null | undefined): Tri => (b === true ? "yes" : b === false ? "no" : "");
const fromTri = (t: Tri): boolean | null => (t === "yes" ? true : t === "no" ? false : null);
const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export function ListingForm({
  groupId,
  userId,
  listing,
  onSaved,
  onCancel,
}: {
  groupId: string;
  userId: string;
  listing?: Listing;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState({
    title: listing?.title ?? "",
    area: listing?.area ?? "Baner",
    address: listing?.address ?? "",
    source_url: listing?.source_url ?? "",
    rent: listing?.rent?.toString() ?? "",
    deposit: listing?.deposit?.toString() ?? "",
    bedrooms: listing?.bedrooms?.toString() ?? "3",
    bathrooms: listing?.bathrooms?.toString() ?? "",
    floor: listing?.floor?.toString() ?? "",
    has_lift: toTri(listing?.has_lift),
    parking: toTri(listing?.parking),
    pet_friendly: toTri(listing?.pet_friendly),
    sharing_allowed: toTri(listing?.sharing_allowed),
    furnishing: listing?.furnishing ?? "",
    available_from: listing?.available_from ?? "",
    notes: listing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const row = {
      title: f.title.trim(),
      area: f.area.trim(),
      address: f.address.trim() || null,
      source_url: f.source_url.trim() || null,
      rent: Number(f.rent),
      deposit: num(f.deposit),
      bedrooms: num(f.bedrooms),
      bathrooms: num(f.bathrooms),
      floor: num(f.floor),
      has_lift: fromTri(f.has_lift),
      parking: fromTri(f.parking),
      pet_friendly: fromTri(f.pet_friendly),
      sharing_allowed: fromTri(f.sharing_allowed),
      furnishing: f.furnishing || null,
      available_from: f.available_from || null,
      notes: f.notes.trim() || null,
    };
    const result = listing
      ? await supabase.from("listings").update(row).eq("id", listing.id).select("id").single()
      : await supabase.from("listings").insert({ ...row, group_id: groupId, added_by: userId }).select("id").single();
    setSaving(false);
    if (result.error) setError(errorMessage(result.error));
    else onSaved(result.data.id);
  }

  const tri = (k: "has_lift" | "parking" | "pet_friendly" | "sharing_allowed", label: string) => (
    <div>
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <select id={k} className="input" value={f[k]} onChange={set(k)}>
        <option value="">Not sure yet</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );

  return (
    <form onSubmit={save} className="card space-y-4">
      <p className="text-sm text-slate-500">
        Leave anything you don&apos;t know as &quot;Not sure yet&quot; — the app will flag it as something to check rather
        than guess.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            Title *
          </label>
          <input id="title" className="input" placeholder="3BHK near Baner Road, Pancard Club" value={f.title} onChange={set("title")} required maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="area">
            Area *
          </label>
          <input id="area" className="input" list="areas" value={f.area} onChange={set("area")} required />
          <datalist id="areas">
            {PUNE_AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="address">
            Address / society
          </label>
          <input id="address" className="input" value={f.address} onChange={set("address")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="url">
            Link to the original listing
          </label>
          <input id="url" className="input" type="url" placeholder="https://…" value={f.source_url} onChange={set("source_url")} />
        </div>
        <div>
          <label className="label" htmlFor="rentl">
            Total monthly rent (₹) *
          </label>
          <input id="rentl" className="input" type="number" min={1} value={f.rent} onChange={set("rent")} required />
          {f.rent && <p className="mt-1 text-xs text-slate-500">₹{Math.ceil(Number(f.rent) / 3).toLocaleString("en-IN")} each</p>}
        </div>
        <div>
          <label className="label" htmlFor="depl">
            Total deposit (₹)
          </label>
          <input id="depl" className="input" type="number" min={0} value={f.deposit} onChange={set("deposit")} />
        </div>
        <div>
          <label className="label" htmlFor="bed">
            Bedrooms (BHK)
          </label>
          <input id="bed" className="input" type="number" min={0} max={10} value={f.bedrooms} onChange={set("bedrooms")} />
        </div>
        <div>
          <label className="label" htmlFor="bath">
            Bathrooms
          </label>
          <input id="bath" className="input" type="number" min={0} max={10} value={f.bathrooms} onChange={set("bathrooms")} />
        </div>
        <div>
          <label className="label" htmlFor="floor">
            Floor (0 = ground)
          </label>
          <input id="floor" className="input" type="number" min={-2} max={100} value={f.floor} onChange={set("floor")} />
        </div>
        {tri("has_lift", "Lift")}
        {tri("parking", "Parking")}
        {tri("pet_friendly", "Pets allowed")}
        {tri("sharing_allowed", "Landlord allows flatmates")}
        <div>
          <label className="label" htmlFor="furn">
            Furnishing
          </label>
          <select id="furn" className="input" value={f.furnishing} onChange={set("furnishing")}>
            <option value="">Not sure yet</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="semi">Semi-furnished</option>
            <option value="furnished">Fully furnished</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="avail">
            Available from
          </label>
          <input id="avail" className="input" type="date" value={f.available_from} onChange={set("available_from")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea id="notes" className="input" rows={3} value={f.notes} onChange={set("notes")} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : listing ? "Save changes" : "Add flat"}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
