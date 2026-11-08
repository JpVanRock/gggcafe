#!/usr/bin/env python3
"""Write the answer-key migration for the How to Keep the Book game.

Usage: python3 scripts/iq/build-game-key.py <new-migration-file>

Reads supabase/iq/scorebook-game.json (15 plays and the final line score) and
replaces private.scorebook_game_key / private.scorebook_game_line. The play-by-play
lives in src/lib/scorebook-game.ts; tests/unit/scorebook-game.test.ts checks the key
against it (runners on base, outs, runs and the line score).
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
KEY = ROOT / "supabase" / "iq" / "scorebook-game.json"
BOX_ID = re.compile(r"^[VH][1-9]-[12]$")
FIELDS = {"hit", "reached", "play", "out", "path", "rbi", "lastOut"}


def sql_text(value):
    return "'" + value.replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("migration")
    out = pathlib.Path(parser.parse_args().migration)
    key = json.loads(KEY.read_text())

    errors = []
    plays = key.get("plays", [])
    if [p.get("n") for p in plays] != list(range(1, 16)):
        errors.append("plays must be numbered 1-15 in order")
    for p in plays:
        for box, marks in p.get("boxes", {}).items():
            if not BOX_ID.match(box):
                errors.append(f"play {p.get('n')}: bad box id {box}")
            if set(marks) - FIELDS:
                errors.append(f"play {p.get('n')} {box}: unknown fields {sorted(set(marks) - FIELDS)}")
    line = key.get("line", {})
    if set(line) != {"V", "H"} or any(len(line[t]) != 2 for t in line):
        errors.append("line needs V and H with two innings each")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    rows = ",\n".join(
        f"  ({p['n']}, {sql_text(json.dumps(p['boxes'], separators=(',', ':')))}::jsonb)" for p in plays
    )
    out.write_text(
        "\n".join(
            [
                "-- =============================================================================",
                "-- GGG.Cafe — How to Keep the Book game: answer key (generated; do not edit by hand)",
                "-- Source: supabase/iq/scorebook-game.json",
                "-- Regenerate: python3 scripts/iq/build-game-key.py <new migration file>",
                "-- =============================================================================",
                "",
                "delete from private.scorebook_game_key;",
                "insert into private.scorebook_game_key (play, boxes) values",
                rows + ";",
                "",
                "insert into private.scorebook_game_line (id, line)",
                f"values (true, {sql_text(json.dumps(line, separators=(',', ':')))}::jsonb)",
                "on conflict (id) do update set line = excluded.line;",
                "",
            ]
        )
    )
    print(f"wrote {out} ({len(plays)} plays)")


if __name__ == "__main__":
    main()
