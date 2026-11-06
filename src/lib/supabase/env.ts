/**
 * Supabase connection settings, read from .env.local (see .env.example).
 * Returns null when the project isn't configured yet so pages can say so
 * instead of crashing.
 */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("YOUR-PROJECT-REF")) return null;
  return { url, key };
}

export function requireSupabaseConfig(): { url: string; key: string } {
  const config = supabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  return config;
}
