#!/usr/bin/env python3
"""Validate the IQ test question files and write the seeding migration.

Usage: python3 scripts/iq/build-playbook-migration.py <new-migration-file>

Reads
  supabase/iq/defense.json, baserunning.json  playbook levels: Levels 1-3, at most 30 each
  supabase/iq/offense.json, battery.json      Offense IQ and Battery IQ (written for GGG.Cafe, no playbook
                                              pages): Levels 1-3, 20-30 each; the award is the MVP badge.
                                              battery.json is optional until it exists
  supabase/iq/positions.json                  position (Golden Glove) tests: exactly 21 per position
  supabase/iq/extra.json                      Extra Credit Library: any number, each with a "book"
                                              (defense/baserunning) and a "section" (library shelf)
  supabase/iq/scorebook.json                  How to Keep the Book chapter quizzes: exactly 5 per chapter
                                              (1-6), each with the guide "page" (or null) and an optional
                                              scorebook picture (box, sheet or field; see src/lib/scorebook.ts)

Every question gets a stable slug: {track}-{level}-{nn} for the playbook tracks,
position-{pos}-{nn} for positions, extra-{book}-{nn} for the library and scorebook-{chapter}-{nn}
for the course quizzes, numbered in file
order within its level, position or book.
The migration upserts on that slug, so the files can be edited and a new migration
generated: changed questions update in place, new ones are added, players' past answers
stay attached, and questions removed from the files are hidden (not deleted). Append new
questions at the end of their level or position; inserting in the middle shifts the slugs.
"""
import argparse
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
IQ = ROOT / "supabase" / "iq"
BASES = {"home", "first", "second", "third"}
FIELDERS = ("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF")
SPOTS = {"LF-line", "LCF-gap", "RCF-gap", "RF-line", "deep-LF", "deep-CF", "deep-RF", "bunt-3B", "bunt-1B",
         "bunt-P", "bunt-C", "blooper-LF", "blooper-CF", "blooper-RF", "popup-C", "popup-IF"}
BALL_TYPES = {"ground", "line", "fly", "popup", "bunt", "blooper"}
ARROW_KINDS = {"run", "steal", "throw"}
MAX_PER_LEVEL = 30   # the user's cap for each playbook level
MIN_PER_LEVEL = 20   # below this a level is too thin to test
PER_POSITION = 21    # the user's count for each position test
SCOREBOOK_CHAPTERS = 6
PER_CHAPTER = 5      # a short quiz at the end of each course chapter
BOX_KEYS = {"kind", "balls", "strikes", "reached", "hit", "path", "fresh", "play", "out", "rbi", "lastOut", "notes", "highlight"}
SHEET_KEYS = {"kind", "innings", "rows", "names", "stats", "cells", "highlight", "squiggle", "arrow", "tag"}
FIELD_KEYS = {"kind", "labels", "highlight", "ball", "throws"}


def check_question(where, q):
    errors = []
    for field in ("scenario", "question", "explanation", "hint"):
        if not isinstance(q.get(field), str) or not q[field].strip():
            errors.append(f"{where}: missing {field}")
    choices = q.get("choices")
    if not isinstance(choices, list) or len(choices) != 4 or not all(isinstance(c, str) and c.strip() for c in choices):
        return errors + [f"{where}: needs exactly 4 non-empty choices"]
    if len({c.strip().lower() for c in choices}) != 4:
        errors.append(f"{where}: duplicate choices")
    if q.get("correct_index") not in (0, 1, 2, 3):
        errors.append(f"{where}: correct_index must be 0-3")
    elif isinstance(q.get("hint"), str):
        answer = choices[q["correct_index"]].strip().lower().rstrip(".")
        if len(answer) > 12 and answer in q["hint"].lower():
            errors.append(f"{where}: hint gives the answer away")
    # null: written for GGG.Cafe (not from a playbook page)
    if q.get("playbook_page") is not None and not isinstance(q.get("playbook_page"), int):
        errors.append(f"{where}: playbook_page must be a page number or null")

    d = q.get("diagram") or {}
    runners = d.get("runners", [])
    if not set(runners) <= {"first", "second", "third"}:
        errors.append(f"{where}: runners must be first/second/third")
    if d.get("outs") not in (0, 1, 2):
        errors.append(f"{where}: outs must be 0-2")
    you = d.get("you")
    if you not in FIELDERS and you != "batter" and not (isinstance(you, str) and you.startswith("runner-")):
        errors.append(f"{where}: unknown 'you' {you!r}")
    if isinstance(you, str) and you.startswith("runner-") and you[7:] not in runners:
        errors.append(f"{where}: 'you' is {you} but that base isn't in runners {runners}")
    ball = d.get("ball")
    if ball is not None:
        if ball.get("at") not in set(FIELDERS) | SPOTS:
            errors.append(f"{where}: unknown ball location {ball.get('at')!r}")
        if ball.get("type", "ground") not in BALL_TYPES:
            errors.append(f"{where}: unknown ball type {ball.get('type')!r}")
    count = d.get("count")
    if count is not None and (count.get("balls") not in (0, 1, 2, 3) or count.get("strikes") not in (0, 1, 2)):
        errors.append(f"{where}: count needs balls 0-3 and strikes 0-2")
    for a in d.get("arrows", []) or []:
        if a.get("from") not in BASES | set(FIELDERS) or a.get("to") not in BASES | set(FIELDERS):
            errors.append(f"{where}: arrow endpoints must be bases or fielders: {a}")
        if a.get("kind", "run") not in ARROW_KINDS:
            errors.append(f"{where}: unknown arrow kind {a.get('kind')!r}")
    return errors


def duplicate_scenarios(name, questions):
    scenarios = [q.get("scenario", "").strip() for q in questions]
    return [f"{name}: duplicate scenario: {s[:70]}" for s in {s for s in scenarios if scenarios.count(s) > 1}]


def check_track(track, questions):
    errors, by_level = [], collections.Counter()
    for i, q in enumerate(questions):
        where = f"{track} #{i + 1} (L{q.get('level')} {q.get('topic', '')[:40]})"
        if q.get("level") not in (1, 2, 3):
            errors.append(f"{where}: level must be 1-3")
            continue
        by_level[q["level"]] += 1
        errors += check_question(where, q)
    for lvl in (1, 2, 3):
        if not MIN_PER_LEVEL <= by_level[lvl] <= MAX_PER_LEVEL:
            errors.append(f"{track}: Level {lvl} has {by_level[lvl]} questions, needs {MIN_PER_LEVEL}-{MAX_PER_LEVEL}")
    return errors + duplicate_scenarios(track, questions)


def check_positions(questions):
    errors, count = [], collections.Counter()
    for i, q in enumerate(questions):
        where = f"positions #{i + 1} ({q.get('position')} {q.get('topic', '')[:40]})"
        if q.get("position") not in FIELDERS:
            errors.append(f"{where}: position must be one of {', '.join(FIELDERS)}")
            continue
        count[q["position"]] += 1
        errors += check_question(where, q)
        if (q.get("diagram") or {}).get("you") != q["position"]:
            errors.append(f"{where}: the diagram's 'you' must be {q['position']}")
    for pos in FIELDERS:
        if count[pos] != PER_POSITION:
            errors.append(f"positions: {pos} has {count[pos]} questions, needs {PER_POSITION}")
    return errors + duplicate_scenarios("positions", questions)


def check_extra(questions):
    errors = []
    for i, q in enumerate(questions):
        where = f"extra #{i + 1} ({q.get('book')} {q.get('section')} {q.get('topic', '')[:30]})"
        if q.get("book") not in ("defense", "baserunning"):
            errors.append(f"{where}: book must be defense or baserunning")
        if not isinstance(q.get("section"), str) or not 0 < len(q["section"].strip()) <= 32:
            errors.append(f"{where}: section must be a short shelf name")
        # technique and vocabulary questions may have no diagram
        errors += check_question(where, q if q.get("diagram") is not None else {**q, "diagram": {"outs": 0, "you": "batter"}})
    return errors + duplicate_scenarios("extra", questions)


def check_box_marks(where, marks):
    errors = []
    unknown = set(marks) - BOX_KEYS
    if unknown:
        errors.append(f"{where}: unknown box keys {sorted(unknown)}")
    if marks.get("reached") not in (None, "BB", "HP", "SAC"):
        errors.append(f"{where}: reached must be BB, HP or SAC")
    if marks.get("hit") not in (None, 1, 2, 3, 4):
        errors.append(f"{where}: hit must be 1-4")
    if marks.get("path") not in (None, 0, 1, 2, 3, 4):
        errors.append(f"{where}: path must be 0-4")
    if marks.get("out") not in (None, 1, 2, 3):
        errors.append(f"{where}: out must be 1-3")
    return errors


def check_scorebook(questions):
    errors = []
    by_chapter = collections.Counter()
    for i, q in enumerate(questions):
        where = f"scorebook #{i + 1} (ch {q.get('chapter')} {q.get('question', '')[:30]})"
        if q.get("chapter") not in range(1, SCOREBOOK_CHAPTERS + 1):
            errors.append(f"{where}: chapter must be 1-{SCOREBOOK_CHAPTERS}")
        by_chapter[q.get("chapter")] += 1
        if q.get("page") is not None and not isinstance(q.get("page"), int):
            errors.append(f"{where}: page must be a page number or null")
        # the shared checks want a playbook page and a diamond; scorebook pictures are checked below
        errors += check_question(where, {**q, "playbook_page": 0, "diagram": {"outs": 0, "you": "batter"}})
        d = q.get("diagram")
        if d is None:
            continue
        kind = d.get("kind")
        if kind == "box":
            errors += check_box_marks(where, d)
        elif kind == "sheet":
            unknown = set(d) - SHEET_KEYS
            if unknown:
                errors.append(f"{where}: unknown sheet keys {sorted(unknown)}")
            rows, innings = d.get("rows", 9), d.get("innings")
            if not isinstance(innings, int) or not 1 <= innings <= 6:
                errors.append(f"{where}: sheet innings must be 1-6")
            for key, marks in (d.get("cells") or {}).items():
                r, _, n = key.partition("-")
                if not (r.isdigit() and n.isdigit() and 1 <= int(r) <= rows and 1 <= int(n) <= (innings or 0)):
                    errors.append(f"{where}: cell {key} is off the sheet")
                errors += check_box_marks(f"{where} cell {key}", {"kind": "box", **marks})
        elif kind == "field":
            unknown = set(d) - FIELD_KEYS
            if unknown:
                errors.append(f"{where}: unknown field keys {sorted(unknown)}")
            if d.get("labels", "numbers") not in ("numbers", "letters"):
                errors.append(f"{where}: labels must be numbers or letters")
            ball = d.get("ball")
            if ball is not None and (ball.get("to") not in range(1, 10) or ball.get("type", "ground") not in ("ground", "fly", "line")):
                errors.append(f"{where}: ball needs a fielder 1-9 and a type")
        else:
            errors.append(f"{where}: diagram kind must be box, sheet or field")
    for ch in range(1, SCOREBOOK_CHAPTERS + 1):
        if by_chapter[ch] != PER_CHAPTER:
            errors.append(f"scorebook: chapter {ch} has {by_chapter[ch]} questions, needs {PER_CHAPTER}")
    return errors + duplicate_scenarios("scorebook", questions)


def slugged(questions, group, prefix):
    """[(slug, question)]: numbered in file order within each group (level or position)."""
    seen = collections.Counter()
    out = []
    for q in questions:
        g = group(q)
        seen[g] += 1
        out.append((f"{prefix(q)}-{seen[g]:02d}", q))
    return sorted(out, key=lambda pair: pair[0])


def sql_text(value):
    return "'" + value.replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("migration")
    out = pathlib.Path(parser.parse_args().migration)

    tracks = {t: json.loads((IQ / f"{t}.json").read_text()) for t in ("defense", "baserunning", "offense", "battery") if (IQ / f"{t}.json").exists()}
    positions = json.loads((IQ / "positions.json").read_text())
    extra = json.loads((IQ / "extra.json").read_text())
    scorebook = json.loads((IQ / "scorebook.json").read_text())
    errors = [e for t, qs in tracks.items() for e in check_track(t, qs)] + check_positions(positions) + check_extra(extra)
    errors += check_scorebook(scorebook)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    # (slug, track, level, position, topic, section, question)
    items = []
    for track, qs in tracks.items():
        for slug, q in slugged(qs, lambda q: q["level"], lambda q, t=track: f"{t}-{q['level']}"):
            items.append((slug, track, q["level"], None, "general", None, q))
    for slug, q in slugged(positions, lambda q: q["position"], lambda q: f"position-{q['position'].lower()}"):
        items.append((slug, "position", 1, q["position"], "position", None, q))
    for slug, q in slugged(extra, lambda q: q["book"], lambda q: f"extra-{q['book']}"):
        shelf = f"{'Defense' if q['book'] == 'defense' else 'Baserunning'} · {q['section'].strip()}"
        items.append((slug, "extra", 1, None, "general", shelf, q))
    for slug, q in slugged(scorebook, lambda q: q["chapter"], lambda q: f"scorebook-{q['chapter']}"):
        items.append((slug, "scorebook", q["chapter"], None, "general", None, q))

    rows, backfill = [], []
    for slug, track, level, position, topic, section, q in items:
        if track == "scorebook":
            ref = f"How to Keep the Book · Chapter {level}" + (f" · scorekeeping guide p.{q['page']}" if q.get("page") else "")
        elif q.get("playbook_page") is None:
            name = {"offense": "Offense IQ", "battery": "Battery IQ"}.get(track, "Softball IQ")
            ref = f"GGG.Cafe {name}" + (f" · {q['topic']}" if q.get("topic") else "")
        else:
            book = "Baserunning" if track == "baserunning" or q.get("book") == "baserunning" else "Defensive"
            ref = f"{book} Playbook p.{q['playbook_page']}" + (f" · {q['topic']}" if q.get("topic") else "")
        rows.append(
            "  ({slug}, {topic}, {position}, {track}, {level}, {section}, {scenario}, {question}, {choices}, {correct}, {explanation}, {hint}, {difficulty}, {diagram}::jsonb, {ref})".format(
                slug=sql_text(slug),
                topic=sql_text(topic),
                section=sql_text(section) if section else "null",
                position=sql_text(position) if position else "null",
                track=sql_text(track),
                level=level,
                scenario=sql_text(q["scenario"].strip()),
                question=sql_text(q["question"].strip()),
                choices="array[" + ", ".join(sql_text(c.strip()) for c in q["choices"]) + "]",
                correct=q["correct_index"],
                explanation=sql_text(q["explanation"].strip()),
                hint=sql_text(q["hint"].strip()),
                difficulty=level if track in ("defense", "baserunning", "offense", "battery") else 1 if track == "scorebook" else 2,
                diagram=sql_text(json.dumps(q["diagram"], separators=(",", ":"))) if q.get("diagram") is not None else "null",
                ref=sql_text(ref),
            )
        )
        if track in ("defense", "baserunning"):
            backfill.append(
                f"update public.iq_questions set slug = {sql_text(slug)} where slug is null and track = {sql_text(track)}"
                f" and level = {level} and scenario = {sql_text(q['scenario'].strip())};"
            )

    lines = [
        "-- =============================================================================",
        "-- GGG.Cafe — IQ test questions (generated; do not edit by hand)",
        "-- Source: supabase/iq/defense.json, baserunning.json, offense.json, battery.json, positions.json,",
        "-- extra.json and scorebook.json, written for GGG.Cafe (playbook levels from the user's",
        "-- Defensive and Baserunning Playbooks, the course from the user's scorekeeping guide).",
        "-- Regenerate: python3 scripts/iq/build-playbook-migration.py <new migration file>",
        "-- =============================================================================",
        "",
        "-- 1. Questions seeded before slugs existed: attach the slug of the same question",
        "--    (matched on its scenario), so they are updated in place and keep their answers.",
        *backfill,
        "",
        "-- 2. Add new questions and update existing ones. A question a coach has hidden stays hidden.",
        "insert into public.iq_questions",
        "  (slug, topic, position, track, level, section, scenario, question, choices, correct_index, explanation, hint, difficulty, diagram, playbook_ref)",
        "values",
        ",\n".join(rows),
        "on conflict (slug) do update set",
        "  topic = excluded.topic, position = excluded.position, track = excluded.track, level = excluded.level, section = excluded.section,",
        "  scenario = excluded.scenario, question = excluded.question, choices = excluded.choices,",
        "  correct_index = excluded.correct_index, explanation = excluded.explanation, hint = excluded.hint,",
        "  difficulty = excluded.difficulty, diagram = excluded.diagram, playbook_ref = excluded.playbook_ref;",
        "",
        "-- 3. Test questions no longer in the files are retired (hidden; answers kept).",
        "update public.iq_questions set active = false",
        " where track is not null and (slug is null or slug not in (",
        "   " + ",\n   ".join(sql_text(item[0]) for item in items),
        " ));",
    ]
    out.write_text("\n".join(lines) + "\n")
    counts = {t: dict(collections.Counter(q["level"] for q in qs)) for t, qs in tracks.items()}
    counts["positions"] = dict(collections.Counter(q["position"] for q in positions))
    counts["extra"] = dict(collections.Counter(q["book"] for q in extra))
    counts["scorebook"] = dict(collections.Counter(q["chapter"] for q in scorebook))
    print(f"wrote {out} ({len(rows)} questions): {counts}")


if __name__ == "__main__":
    main()
