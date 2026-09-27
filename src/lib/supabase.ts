import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// One shared browser client. The session is kept in the browser's local storage.
export const supabase: SupabaseClient = isConfigured
  ? createClient(url!, key!, { auth: { persistSession: true } })
  : (null as unknown as SupabaseClient);

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong. Please try again.";
}
