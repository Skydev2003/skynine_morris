import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client: SupabaseClient | undefined;

export const onlineConfigured = Boolean(url && key);

export function browserDb() {
  if (typeof window === "undefined" || !url || !key) return undefined;
  return client ??= createClient(url, key);
}
