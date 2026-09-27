// POST /api/analyze  { url }  →  { fields, readPage, missing }
// Downloads the one listing page a roommate pasted (like a chat app's link preview) and pulls out
// the flat's details. If the site blocks the download, we fall back to what the link itself says.

import { createClient } from "@supabase/supabase-js";
import { extractListing, KEY_FIELDS } from "@/lib/extract";

const MAX_BYTES = 3_000_000;

export async function POST(request: Request) {
  // Only signed-in users can use this, so it can't be abused as an open proxy.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { data: user, error: authError } = await createClient(url, key).auth.getUser(token);
  if (authError || !user.user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  let link: URL;
  try {
    const body = await request.json();
    link = new URL(String(body.url ?? "").trim());
  } catch {
    return Response.json({ error: "That doesn't look like a link. Copy the full address from the listing page." }, { status: 400 });
  }
  if (!isPublicWebLink(link)) {
    return Response.json({ error: "Please paste a normal https:// link to a listing page." }, { status: 400 });
  }

  const html = await download(link);
  const fields = extractListing(link.toString(), html);
  const missing = KEY_FIELDS.filter((f) => fields[f.key] === undefined || fields[f.key] === null).map((f) => f.label);

  return Response.json({ fields, readPage: html !== null, missing });
}

function isPublicWebLink(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false; // raw IP addresses
  return host.includes(".");
}

async function download(u: URL): Promise<string | null> {
  try {
    const res = await fetch(u, {
      headers: {
        "User-Agent": "MyFlattie/1.0 (link preview for a roommate's own listing)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  }
}
