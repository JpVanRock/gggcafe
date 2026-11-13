// The site's main address (user, 2026-11-13). Vercel serves www.ggg.cafe and redirects ggg.cafe to
// it; gggcafe.vercel.app still works. Use SITE_URL where an address has to be fixed (text in
// emails and PDFs); links made during a request use requestOrigin() (src/lib/request-origin.ts), so
// they match whichever address the visitor is on, and localhost when testing.
export const SITE_URL = "https://www.ggg.cafe";
