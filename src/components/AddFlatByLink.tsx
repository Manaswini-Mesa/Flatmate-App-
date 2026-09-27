"use client";

import Link from "next/link";
import { useState } from "react";
import { siteName } from "@/lib/constants";
import type { ImportedFields } from "@/lib/extract";
import { errorMessage, supabase } from "@/lib/supabase";
import type { GroupData } from "@/lib/useGroupData";

type Outcome =
  | { kind: "added"; id: string; title: string; site: string; found: number; readPage: boolean; missing: string[] }
  | { kind: "duplicate"; id: string; title: string }
  | { kind: "error"; message: string };

const NOT_DETAILS = new Set(["title", "notes", "image_url", "latitude", "longitude", "address"]);

// The only thing anyone has to do to add a flat: paste the listing link.
export function AddFlatByLink({ data, userId }: { data: GroupData; userId: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const link = url.trim();
    setOutcome(null);

    const existing = data.listings.find((l) => l.source_url === link);
    if (existing) {
      setOutcome({ kind: "duplicate", id: existing.id, title: existing.title });
      return;
    }

    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ url: link }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read that link.");
      const fields = body.fields as ImportedFields;

      const { data: row, error } = await supabase
        .from("listings")
        .insert({ ...fields, title: fields.title ?? "Flat", source_url: link, group_id: data.group.id, added_by: userId })
        .select("id, title")
        .single();
      if (error) throw error;

      const found = Object.entries(fields).filter(([k, v]) => !NOT_DETAILS.has(k) && v !== null && v !== undefined).length;
      setOutcome({
        kind: "added",
        id: row.id,
        title: row.title,
        site: siteName(link) ?? "the site",
        found,
        readPage: body.readPage,
        missing: body.missing,
      });
      setUrl("");
    } catch (err) {
      setOutcome({ kind: "error", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card border-emerald-500/30">
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="flat-link" className="sr-only">
          Listing link
        </label>
        <input
          id="flat-link"
          className="input py-2.5"
          type="url"
          required
          placeholder="Paste a listing link — NoBroker, MagicBricks, 99acres, Housing…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn-primary shrink-0 py-2.5" disabled={busy}>
          {busy ? "Reading the listing…" : "Add & analyze"}
        </button>
      </form>

      {outcome?.kind === "added" && (
        <div className="mt-3 text-sm">
          <p className="text-emerald-300">
            ✓ Added{" "}
            <Link href={`/listings/${outcome.id}`} className="font-semibold underline">
              {outcome.title}
            </Link>{" "}
            — {outcome.readPage ? `read ${outcome.found} details from ${outcome.site}` : `used ${outcome.found} details from the link`}. It&apos;s
            been graded for all 3 of you below.
          </p>
          {!outcome.readPage && (
            <p className="mt-1 text-amber-300">
              {outcome.site} doesn&apos;t let apps read its pages, so only what&apos;s in the link itself was used.
            </p>
          )}
          {outcome.missing.length > 0 && (
            <p className="mt-1 text-slate-400">
              Not on the listing: {outcome.missing.join(", ")}. These show as &quot;Needs checking&quot; — ask the owner, then
              use <em>Edit details</em> on the flat if you like.
            </p>
          )}
        </div>
      )}
      {outcome?.kind === "duplicate" && (
        <p className="mt-3 text-sm text-amber-300">
          Already added:{" "}
          <Link href={`/listings/${outcome.id}`} className="underline">
            {outcome.title}
          </Link>
        </p>
      )}
      {outcome?.kind === "error" && <p className="mt-3 text-sm text-red-400">{outcome.message}</p>}
    </div>
  );
}
