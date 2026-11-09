# Movement Preferences and Preferred Hitting Style (Pop Report)
- Movement Preferences is a G3 Advanced feature (user, 2026-11-08): shown (Pop Report section, dashboard
  summary line, move dial, at-bat focus tip) and saved only for players with G3 Advanced; the player's
  read policy needs `private.has_advanced`. Without it nothing shows (admins see a slim locked note in her
  Pop Report); saved versions are kept. Preferred Hitting Style stays Standard.
- Background is the user's movement-preference booklet (2026-11-07): use its ideas, never name it or its
  company, never show testing steps, and write for a 10-year-old. Categories/choices come from the
  user's sheet (POP tab, column A); labels and plain-language text live in `src/lib/movement.ts`
  (`MOVEMENT`, `HITTING`; `coach` = the testing term coaches see in the editor).
- Movement Preferences: coaches set them (`movement_preferences`, versioned: every save is a new row,
  newest = current, history shown to coaches); players read. The move dial (`components/move-dial.tsx`,
  `moveDial()`): both feet, toes up; #1 = her strongest spot (from dial_one, else bouncy+leg = toes /
  grounded+leg = heel); #4 = heel behind a toes #1, or the other foot's toes for a heel #1; #2/#3 from
  space + breath (close+in or wide+out = #2 on the heel side), else "2/3". Breath also gives the at-bat
  focus tip (out = scarlet red, big picture first; in = royal blue, zoom in first).
- Preferred Hitting Style: the player herself or a coach changes it (`hitting_styles`, versioned; the
  player can only add rows in her own name; history shows who changed what).
- Pop Report coach notes (players.notes) are shown to coaches only.
