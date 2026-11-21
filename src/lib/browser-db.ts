import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client: SupabaseClient | undefined;

export const onlineConfigured = Boolean(url && key);
export const googleInviteKey = "morris-google-invite";

export async function googleSignInEnabled(signal: AbortSignal): Promise<boolean | null> {
  if (!url || !key) return false;
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: key },
    cache: "no-store",
    signal,
  });
  if (!response.ok) return null;
  const { external } = await response.json();
  return typeof external?.google === "boolean" ? external.google : null;
}

export function browserDb() {
  if (typeof window === "undefined" || !url || !key) return undefined;
  return client ??= createClient(url, key);
}
