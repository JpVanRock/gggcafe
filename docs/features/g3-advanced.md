# G3 Advanced (Level 2, `/players/[id]/advanced`)
- The advanced tier (user, 2026-11-07): admin-approved per player now, a paid subscription later
  (`player_advanced_access`, one row per player who has it, `source` admin|subscription; only admins
  insert/delete; `private.has_advanced()`). Until unlocked NOTHING about it shows on her pages, for anyone:
  no menu board, no section-menu entry, no Movement Preferences note, pages 404 for non-admins (user,
  2026-11-12: players mustn't learn it exists until it's unlocked). Admins unlock it on Coaches Dugout → Roster
  (the admin-only "G3 Advanced" column: Unlock / Turn off), and can also turn it off at the bottom of her book
  (her work is kept).
- It's her book on how to compete: default title "How to Cook" (user's choice; she can rename it,
  `player_advanced_books`), theme line "How to Compete". Content in `src/lib/advanced-book.ts`, which
  is paid content: import it from server code only, never from a "use client" file (client pieces
  get one chapter as props). Introduction "It Starts with Good Habits", then chapters from the user's
  "How to Compete?" sheet (Pre-Game, Between Innings, On-Deck Reps, Response to Failure,
  Communication, Regardless of Circumstances), then "coming" chapters (My Position, Hitting
  Approach, Mental Toughness: content later). ALWAYS leave room for more chapters: add an entry to
  `CHAPTERS` with a new permanent slug (numbers come from order; her work is keyed by slug).
- Each chapter: the question, why it matters, a pre-filled foundation of habits she marks "I own
  this", then she builds on it (her own habits, notes) and marks it complete
  (`player_advanced_chapters`). Players keep their own book only while they have access (RLS).
  Menu board variant `advanced`, placed before the Trophy Room; section menu entry after Softball IQ.
- Position chapters (user, 2026-11-07): a chapter with `requires: { position }` is only in the book
  of a player a coach has confirmed at that position (`player_confirmed_positions`; coaches/admins
  confirm on her book page, "Coaches · position chapters"; the player can read, not change, it).
  For everyone else it isn't listed, numbered, counted or readable (404), and saves are refused.
  Always build her book with `visibleChapters(book.confirmed)`. First one: "Pitching: My Best Is
  Better" (Focused Skill), from the user's pitching sheet, Chapter 7 for confirmed pitchers.
