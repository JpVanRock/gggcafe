# UI components, type scale and accessibility

The shared look of every page. Build new screens from these pieces, not from hand-written class
strings. `tests/unit/ui-rules.test.ts` checks the rules marked **(tested)** on every push.

## Type scale (one size per job)

| Class | Size | Use it for |
|---|---|---|
| `text-2xs` | 12px | Uppercase labels only: badges, counts, eyebrows, table headers, card section labels. The smallest size on the site **(tested)**. |
| `text-xs` | 13px | Hints under a field, captions, timestamps, footnotes (sentence case) |
| `text-sm` | 15px | The interface: buttons, form fields, tables, lists, card text |
| `text-base` | 17px | Reading: lessons, chapters, long notes and answers |
| `text-lg` and up | 19px+ | Titles, in Jost (`PageHeader` is `text-2xl`) |

Never `text-[10px]`/`text-[11px]` or other arbitrary sizes under 12px **(tested)**.

## Fonts

DM Sans for body, interface and every small label, kicker, chip and table header; Jost for titles, tables' numbers
and anything `tabular-nums`. Space Mono was dropped (the user, 2026-11-18): `font-mono` is now the system monospace,
nothing downloaded, and only for text someone types exactly (the username on Logins & Teams, the `/register` path on
the Mentors tab, the team-code field on the mentor page) **(tested)**. A label that showed numbers in Space Mono with
`tabular-nums` is Jost (`font-display`), since DM Sans has no tabular figures.

## Color by role

`text-highlight` for emphasis, `text-link` for pink text and links (brand pink at night, a darker
pink by day, because brand pink is 3.7:1 on white) **(tested)**, `text-on-accent` on neon or pink
fills, `text-pink-soft` for small pink labels. No zinc/gray/slate and no `dark:` **(tested)**. Neon edges (borders, rings)
use `border-neon-edge`: neon at night, brand navy by day, where neon on white is 1.15:1 **(tested)**. `--color-numeral` is
the big outlined jersey number behind a name (faint pink at night, light by day so it never fights the name).
Day Game's text colors (muted, pink, red) are 7:1 or more on white and the cards (user, 2026-11-21: the 5.5:1 pink in
small letter-spaced labels was hard to read). Text on a pink board is full navy (5.3:1, the most navy gets on brand pink),
never faded. Browsers' own night modes stay off, so both games show as designed: the root layout's
`<meta name="darkreader-lock">` (Firefox for iPhone's night mode and the Dark Reader extensions; they had turned Day Game
into pale text and black fields on white, user 2026-11-21) and Day Game's `color-scheme: only light` (Chrome's auto dark).

## Components (`src/components/ui.tsx` unless noted)

| Component | Props | Notes |
|---|---|---|
| `Field` | `label`, `hint?`, `error?`, `required?`, `children` | Wraps the control in its label. A plain `<input>`/`<select>`/`<textarea>` child gets `aria-describedby` for the hint and error, and `aria-invalid` on an error. |
| `fieldClass` / `inputClass` | | `inputClass` is full width; a control that sets its own width uses `fieldClass` + `w-*`. Every text field, drop-down and text area gets its look from these (a hand-written `border-navy-*` on a field fails `ui-rules`): the edge is the `field` token (3:1 or more on the page and cards in both themes, WCAG 1.4.11) and placeholders are full `text-muted`. On phones globals.css keeps every field's text at 16px or more, so iPhones don't zoom in when it is tapped. Every `<select>` gets the site's chevron and matches text boxes (globals.css). |
| `buttonStyles(variant, extra?)` | `primary` `secondary` `pill` `pillOutline` `pillQuiet` `danger` `remove` `removeQuiet` `link` | For `<button>`, `<Link>` and `<label>`. `buttonClass`, `secondaryButtonClass`, `pill*Class` are the same looks. Disabled buttons turn grey. `remove` (red) and `removeQuiet` (grey until hovered) are the small "Remove"/"Delete" beside a row; they and `link` are 40px tall on phones so a thumb can hit them. A row of buttons uses one look, with at most one filled accent (the "From the Dugout" strip: quiet pills and + Activity). |
| `SubmitButton` (`submit-button.tsx`) | `variant?`, `pendingLabel?` ("Saving…"), button props | Spinner + "Saving…" while its form's action runs; disabled meanwhile. With `name`/`value`, only the pressed one spins. |
| `ActionForm` (`action-form.tsx`) | `action`, form props | Shows the action's error after the controls; `aria-busy` while saving, and its submit buttons dim and can't be pressed twice. When the action returns `invalid("field", message)`, that field turns red (`aria-invalid`), gets focus, and clears when edited. |
| `FormMessage` (`form-message.tsx`) | `error`, `saved?`, `fields?` | The message under a client form; pass `fields={state.fields}` and it marks the named fields the same way. |
| `ConfirmSubmit` (`confirm-submit.tsx`) | `message`, `confirmLabel?`, `tone?` (`danger`/`primary`), `className`, `label?` | A submit button that asks first in the site's own dialog. Cancel has focus; Esc or a click outside cancels. `label` names it for screen readers when the same text repeats on every row ("Remove Field rental, $120.00"). |
| `confirmAction(message, options?)` | | The same dialog from code: `if (!(await confirmAction("Remove this session?"))) return;`. Never `window.confirm` **(tested)**. |
| `Badge` / `badgeClass(tone, size?)` | tone: `neutral` `ink` `pink` `pinkSolid` `neonOutline` `neon` `danger`; size `sm`/`md` | Status chips (Draft, Final, Game-ready). `md` (32px tall) for chips that are buttons. No hand-made chips **(tested)**. |
| `CountBadge` | `count`, `label`, `tone?` | Round counts in menus and tabs. Nothing at 0, "99+" past 99; screen readers hear `label`. |
| `Eyebrow` / `eyebrowClass` | | The spaced-caps kicker above a title or group. |
| `sectionLabelClass` | | Card and section headings (what `Card` uses). |
| `groupLabelClass` | | The bold DM Sans label over a group, list or column ("UPCOMING", "NOTES"); add its color (`text-pink-soft`, `text-muted`). These three are the only small-label recipes: a hand-written `font-mono text-2xs font-bold tracking-[0.2em]` fails `ui-rules`. Labels stay short; a rule or sentence goes under the label in DM Sans (`text-sm text-muted`), not in spaced-out capitals. |
| `Card` | `title?`, `actions?`, `tone?` (`raised`/`inset`), `className?` | `rounded-xl`; `inset` for a box inside a card. |
| `cardClass(tone)` | `raised` / `inset` | The same box for a tile, list item or form that isn't a titled `Card`; add your own padding. The cafe-menu boards (`rounded-2xl`) keep their own looks. |
| `Disclosure` | `summary`, `open?` | A section that opens on tap. Flat (a divider above, no box), so it is never a card inside a card. |
| `ActionDisclosure` | `label`, `open?` | A page's main "new" action as a primary button that opens its form in place ("+ New lineup", "+ New practice plan", "+ Add a drill"); open when there's nothing yet. Never hide the page's main action in a quiet `Disclosure`. |
| `EmptyState` | `title?`, `children?`, `action?` | A whole section or list with nothing in it: say what will show up here, and give the action when the viewer can fix it. Inside a card that has other content, one muted sentence (`text-sm text-muted`) is lighter and enough. |
| `Loading` | `label?` | Every `loading.tsx`: a pulsing outline of a page (still for reduced motion); screen readers hear "Loading…". |
| `TabRow` (`tab-row.tsx`) | `label`, `current?` | A tab row that scrolls sideways (Dugout tabs, player sections, age groups): fades at the edge that has more tabs, and scrolls the current tab into view. |
| `TableScroll` | `label`, `className?` | Wraps a wide table: scrolls sideways on phones, focusable and named for keyboard and screen-reader users. It is `relative`, so a column's screen-reader-only label (`sr-only`, absolutely positioned) scrolls with the table; any other sideways scroller (`overflow-x-auto`) needs `relative` too. Unpositioned, those labels widened the page and phones zoomed out (user, 2026-11-22: Team Budget on iPhone sat in the left part of the screen). The body also clips anything wider than the screen (globals.css), and `npm run test:a11y` fails a page that is wider than a 320px phone (WCAG 1.4.10 Reflow). |
| `SiteHeader` (`site-header.tsx`) | `home`, `nav`, `account?` (Sign out), `count?`, `width?` | The one header for staff, player, family and mentor pages. On phones the links and account fold behind a Menu button (`HeaderMenu`) that carries the approvals/notifications count (`MenuCount`); from 640px up it is one row that sticks to the top, with who is signed in, the Night/Day switch and Sign out behind one Account button (`AccountMenu`, `account-menu.tsx`). `StickyHeaderOffset` keeps `--header-h` on `<html>` at the sticky header's height, and `scroll-padding-top` (globals.css) uses it, so keyboard focus and `#anchors` never land under the header (WCAG 2.4.11). Header links use `navClass` and `navItemClass` (40px tap targets on phones). |
| `NavLink` (`nav-link.tsx`) | `href`, `section?`, `exact?` | Header links; the current section is highlighted and `aria-current="page"`. `exact` for a home link. |
| `SkipLink` | | First thing a keyboard user reaches; jumps to `<main id="main">`. Every layout's `<main>` has `id="main"`. |
| `PageHeader`, `FormMessage`, `ShowAllLink`, `PillNav`, `Modal` | | Unchanged. |
| `MenuBoard`, `MenuPanel`, `MenuItem`, `MenuHeader`, `NeedsYou` (`menu-board.tsx`) | | The cafe-menu look (player dashboard, family and mentor menus, user 2026-11-13). `MenuBoard`: a numbered board that is one big link to its section. `MenuPanel`: the same board when it holds its own links or forms (a roster), with an optional `cta` ("Full details →"). `MenuItem`: a menu line (name, value, note) in the board's colors. `MenuHeader`: the media-day page header ("/// FAMILY MENU ///", the name in two tones, `aside` for the team logo). `NeedsYou`: what's waiting on this person, each with where to do it. |
| `PageLinks` (`page-menu.tsx`) | `items` (`href`, `label`, `note?`, `badge?`), `label` | A page's own links in the open under its header (the family menu: Season Forms, Logins & Teams, Join Another Team): one column on phones, three from 640px, a note from 640px, a pink badge when something waits. Never a second Menu button next to the header's. |
| `ComingUpCard` (`coming-up.tsx`) | `items`, `calendarHref`, `teams?`, `subtitle?`, `empty?` | The next weeks of a calendar, by day, as a board with "Full calendar →" (family and mentor menus). |

## Field errors

In a form action, a check on one field returns `invalid("<the field's name>", "Pick the game date.")` (from
`src/lib/form.ts`) instead of `{ error }`. The message shows where it always did, and the form also marks that
field invalid (red border, announced as invalid), moves the cursor into it, and clears the mark as soon as it is
edited (`components/field-errors.ts`). Hidden inputs are never marked.

## Usage

```tsx
<ActionForm action={addGame} className="grid gap-4 sm:grid-cols-2">
  <Field label="Opponent" required>
    <input name="opponent" required className={inputClass} />
  </Field>
  <Field label="Date" hint="Game day, in your team's time zone">
    <input type="date" name="date" className={inputClass} />
  </Field>
  <SubmitButton pendingLabel="Adding…">Add game</SubmitButton>
</ActionForm>

<Badge tone={plan.status === "final" ? "neon" : "pink"}>{plan.status === "final" ? "Final" : "Draft"}</Badge>

<EmptyState title="No games yet" action={<Link href="/dugout/gameday/new" className={buttonClass}>+ Add a game</Link>}>
  Games you add show up here and on every player's TWIS.
</EmptyState>

<ActionForm action={deleteGame}>
  <input type="hidden" name="id" value={game.id} />
  <ConfirmSubmit message="Delete this game? Its box score goes too." label={`Delete the game vs ${opponent}`} className={buttonStyles("remove")}>
    Delete
  </ConfirmSubmit>
</ActionForm>
```

## Checks

- `tests/unit/ui-rules.test.ts` (every push): the rules marked **(tested)** above, plus navy text on neon and pink fills.
- `npm run test:a11y` (every push): axe-core's WCAG 2.2 A/AA rules on every sample-data page in headless Chrome, Night
  Game, then contrast again in Day Game. Fails on critical or serious problems. Dim with a muted color or a dashed
  outline, never with `opacity` on text (that is what failed contrast here).
- `npm run screens`: the key pages at phone and desktop width in both themes, saved to `screens/` (CI artifact
  `screens`); `-- --compare <dir>` marks the pixels that changed since an earlier run.

## Layout and motion

- Phones: the site header is one row (logo, Night/Day switch, Menu) and scrolls away; it sticks only from 640px
  up. The Menu panel closes when a link is tapped or Esc is pressed.
- Touch targets: anything you tap is at least 24px tall; chips that are buttons use `badgeClass(tone, "md")` (32px);
  text-only buttons (`remove`, `removeQuiet`, `link`) are 40px tall on phones. Check-offs use the `check-box` class
  (globals.css): a 24px box with a pink edge, filled with a navy tick when done.
- One box level: inside a card, groups are sections under a divider or a label, not more cards. Corners are
  `rounded-2xl` at most **(tested)**. Headings go in order: a section page's h1, then `DetailHeading` (h2), then h3.
- Phones: a wide table either hides the columns that matter least (`hidden sm:table-cell`, with what they held under
  the name) or becomes a list of one line per row (Players, Budget payments) or labeled cards (GameDay player cards).
  Paragraphs keep a readable measure (`max-w-prose`; the footer disclaimer 80 characters).
- Motion: `motion-safe:` for animations; a global rule turns animations and transitions off for people whose
  device asks for less motion.
- Focus: every link, button, summary and focusable region shows a pink outline when reached by keyboard.
