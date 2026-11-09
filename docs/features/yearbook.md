# Team Yearbook (G3 Advanced, user 2026-11-08; migration 20261108190000)
- Season photos per team (`yearbook_photos`, tags `yearbook_photo_tags`). `private.yearbook_access(team)`:
  coaches/admins manage; view-only staff view; a parent whose approved daughter on the team has G3 Advanced
  adds (and edits/removes her own uploads); a player on the team with G3 Advanced views.
- Private bucket `yearbook-photos`, `<team>/<season>/<timestamp>-<random>.jpg` + `_t.jpg` thumbnail; the browser
  shrinks to 1600px and 480px before upload. Players and parents can't read other players' rows, so names
  (tags, roster for search) come only through `public.team_yearbook(team, season)`.
- One viewer for everyone, `components/yearbook-view.tsx` (+ `src/lib/yearbook.ts`, unit-tested): a cover,
  month-by-month spreads (feature photo, wide/tall tiles), a Thumbnails view, search by player, a full-screen
  view with caption, tags and edit/remove. Pages: `/players/[id]/yearbook` (the Yearbook pill between Team
  Culture and Leaderboard, only with G3 Advanced), `/dugout/yearbook` (from the Culture tab's "What players
  see" strip), `/family/yearbook` (a main menu item and a home card for parents with access).
- Storage (suggested to the user, not built yet): ~300 KB per photo with its thumbnail. Ideas: a storage meter
  and per-team/season cap in the Dugout; archive finished seasons (download a zip, then move originals to cheap
  object storage such as Cloudflare R2, keep thumbnails); WebP/AVIF; hash uploads to skip duplicates.
