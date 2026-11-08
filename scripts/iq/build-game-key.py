#!/usr/bin/env python3
"""Write the answer-key migration for the How to Keep the Book games.

Usage: python3 scripts/iq/build-game-key.py <new-migration-file>

Reads supabase/iq/scorebook-games.json (10 games: 15 plays each and the final line
score) and replaces private.scorebook_game_key / private.scorebook_game_line. The
play-by-play lives in src/lib/scorebook-game.ts; tests/unit/scorebook-game.test.ts
replays every game against it (batting order, runners, outs, runs, line score).
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
KEY = ROOT / "supabase" / "iq" / "scorebook-games.json"
GAMES = 10
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
    games = key.get("games", [])
    if [g.get("n") for g in games] != list(range(1, GAMES + 1)):
        errors.append(f"games must be numbered 1-{GAMES} in order")
    for g in games:
        plays = g.get("plays", [])
        if [p.get("n") for p in plays] != list(range(1, 16)):
            errors.append(f"game {g.get('n')}: plays must be numbered 1-15 in order")
        for p in plays:
            for box, marks in p.get("boxes", {}).items():
                if not BOX_ID.match(box):
                    errors.append(f"game {g.get('n')} play {p.get('n')}: bad box id {box}")
                if set(marks) - FIELDS:
                    errors.append(f"game {g.get('n')} play {p.get('n')} {box}: unknown fields {sorted(set(marks) - FIELDS)}")
        line = g.get("line", {})
        if set(line) != {"V", "H"} or any(len(line[t]) != 2 for t in line):
            errors.append(f"game {g.get('n')}: line needs V and H with two innings each")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    rows = ",\n".join(
        f"  ({g['n']}, {p['n']}, {sql_text(json.dumps(p['boxes'], separators=(',', ':')))}::jsonb)" for g in games for p in g["plays"]
    )
    lines = ",\n".join(f"  ({g['n']}, {sql_text(json.dumps(g['line'], separators=(',', ':')))}::jsonb)" for g in games)
    out.write_text(
        "\n".join(
            [
                "-- =============================================================================",
                "-- GGG.Cafe — How to Keep the Book games: answer keys (generated; do not edit by hand)",
                "-- Source: supabase/iq/scorebook-games.json",
                "-- Regenerate: python3 scripts/iq/build-game-key.py <new migration file>",
                "-- =============================================================================",
                "",
                "delete from private.scorebook_game_key;",
                "insert into private.scorebook_game_key (game, play, boxes) values",
                rows + ";",
                "",
                "delete from private.scorebook_game_line;",
                "insert into private.scorebook_game_line (game, line) values",
                lines + ";",
                "",
            ]
        )
    )
    print(f"wrote {out} ({len(games)} games, {sum(len(g['plays']) for g in games)} plays)")


if __name__ == "__main__":
    main()
