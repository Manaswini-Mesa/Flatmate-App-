"use client";

import { useState } from "react";
import { PUNE_AREAS, siteName, YES_NO_FEATURES } from "@/lib/constants";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Listing } from "@/lib/types";

type Tri = "" | "yes" | "no";

const toTri = (b: boolean | null | undefined): Tri => (b === true ? "yes" : b === false ? "no" : "");
const fromTri = (t: Tri): boolean | null => (t === "yes" ? true : t === "no" ? false : null);
const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));
const str = (n: number | null | undefined): string => (n == null ? "" : n.toString());

const YES_NO_FIELDS = ["has_lift", ...YES_NO_FEATURES.map((f) => f.field)] as const;

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
    source_url: listing?.source_url ?? "",
    title: listing?.title ?? "",
    area: listing?.area ?? "Baner",
    address: listing?.address ?? "",
    rent: str(listing?.rent),
    maintenance: str(listing?.maintenance),
    deposit: str(listing?.deposit),
    brokerage: str(listing?.brokerage),
    bedrooms: listing ? str(listing.bedrooms) : "3",
    bathrooms: str(listing?.bathrooms),
    floor: str(listing?.floor),
    furnishing: listing?.furnishing ?? "",
    available_from: listing?.available_from ?? "",
    notes: listing?.notes ?? "",
  });
  const [yesNo, setYesNo] = useState<Record<string, Tri>>(
    Object.fromEntries(YES_NO_FIELDS.map((k) => [k, toTri(listing?.[k] as boolean | null | undefined)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const site = siteName(f.source_url);
  const monthlyEach = f.rent ? Math.ceil((Number(f.rent) + Number(f.maintenance || 0)) / 3) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const row = {
      source_url: f.source_url.trim() || null,
      title: f.title.trim(),
      area: f.area.trim(),
      address: f.address.trim() || null,
      rent: Number(f.rent),
      maintenance: num(f.maintenance),
      deposit: num(f.deposit),
      brokerage: num(f.brokerage),
      bedrooms: num(f.bedrooms),
      bathrooms: num(f.bathrooms),
      floor: num(f.floor),
      furnishing: f.furnishing || null,
      available_from: f.available_from || null,
      notes: f.notes.trim() || null,
      ...Object.fromEntries(YES_NO_FIELDS.map((k) => [k, fromTri(yesNo[k])])),
    };
    const result = listing
      ? await supabase.from("listings").update(row).eq("id", listing.id).select("id").single()
      : await supabase.from("listings").insert({ ...row, group_id: groupId, added_by: userId }).select("id").single();
    setSaving(false);
    if (result.error) setError(errorMessage(result.error));
    else onSaved(result.data.id);
  }

  const yesNoField = (field: string, label: string) => (
    <div key={field}>
      <label className="label" htmlFor={field}>
        {label}
      </label>
      <select id={field} className="input" value={yesNo[field]} onChange={(e) => setYesNo({ ...yesNo, [field]: e.target.value as Tri })}>
        <option value="">Not sure yet</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );

  return (
    <form onSubmit={save} className="card space-y-6">
      <div>
        <label className="label" htmlFor="url">
          Link to the listing (99acres, MagicBricks, NoBroker, Housing…)
        </label>
        <input id="url" className="input" type="url" placeholder="https://…" value={f.source_url} onChange={set("source_url")} autoFocus={!listing} />
        <p className="mt-1 text-xs text-slate-500">
          {site ? `From ${site}. ` : ""}Open the listing and copy the details below — property sites don&apos;t allow apps to
          read their pages automatically. Leave anything you don&apos;t know as &quot;Not sure yet&quot;.
        </p>
      </div>

      <Group title="Basics">
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
      </Group>

      <Group title="Costs (whole flat)">
        <div>
          <label className="label" htmlFor="rentl">
            Monthly rent (₹) *
          </label>
          <input id="rentl" className="input" type="number" min={1} value={f.rent} onChange={set("rent")} required />
        </div>
        <div>
          <label className="label" htmlFor="maint">
            Monthly maintenance (₹)
          </label>
          <input id="maint" className="input" type="number" min={0} value={f.maintenance} onChange={set("maintenance")} />
        </div>
        <div>
          <label className="label" htmlFor="depl">
            Deposit (₹)
          </label>
          <input id="depl" className="input" type="number" min={0} value={f.deposit} onChange={set("deposit")} />
        </div>
        <div>
          <label className="label" htmlFor="brok">
            Brokerage (₹)
          </label>
          <input id="brok" className="input" type="number" min={0} value={f.brokerage} onChange={set("brokerage")} />
        </div>
        {monthlyEach && (
          <p className="text-sm text-emerald-400 sm:col-span-2">= ₹{monthlyEach.toLocaleString("en-IN")} per person per month</p>
        )}
      </Group>

      <Group title="Size & building">
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
        {yesNoField("has_lift", "Lift")}
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
      </Group>

      <Group title="Features & house rules">{YES_NO_FEATURES.map((feat) => yesNoField(feat.field, feat.label))}</Group>

      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea id="notes" className="input" rows={3} value={f.notes} onChange={set("notes")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : listing ? "Save changes" : "Add flat"}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}
