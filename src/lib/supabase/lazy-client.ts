// The browser Supabase client, loaded the first time it's needed. Only uploads use it (photos, logos,
// journal and message pictures, the Yearbook), and importing it at the top of a component put about
// 220 KB of client code on every page that showed one, the player dashboard included (design audit
// 2026-11-18, S1). Call it inside the upload handler: `const supabase = await browserClient();`.
export async function browserClient() {
  const { createClient } = await import("./client");
  return createClient();
}
