// The sample-data mode for page smoke tests and screenshots (npm run test:pages): every server query
// reads fictional data from src/lib/supabase/sample/ instead of Supabase, signed in as a sample admin.
// Only when GGG_SAMPLE_DATA=1, and never on Vercel, so it can't switch on in production.
export function sampleDataEnabled(): boolean {
  return process.env.GGG_SAMPLE_DATA === "1" && !process.env.VERCEL;
}
