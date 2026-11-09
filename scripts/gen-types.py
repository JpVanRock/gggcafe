#!/usr/bin/env python3
"""Writes src/lib/supabase/database.types.ts from scripts/sql/introspect.sql's JSON.

The output has the same shape as `supabase gen types typescript`, so supabase-js types
every .from(), .select() (including embedded relations), .insert() and .rpc() call.
Usage: python3 scripts/gen-types.py schema.json > database.types.ts
"""
import json
import sys

schema = json.load(open(sys.argv[1]))
# jsonb columns with a known shape (scripts/json-types.json): "table.column" -> {type, from}
import os
JSON_COLUMNS = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(__file__), "json-types.json"))).items() if not k.startswith("_")}
TYPES = schema["types"]
RELS = {r["name"]: r for r in schema["rels"]}
REL_BY_OID = {r["oid"]: r for r in schema["rels"]}

NUMBER = {"int2", "int4", "int8", "float4", "float8", "numeric", "oid", "money"}
STRING = {"text", "varchar", "bpchar", "char", "name", "uuid", "date", "time", "timetz", "timestamp",
          "timestamptz", "interval", "citext", "bytea", "inet", "cidr", "macaddr", "tsvector", "regclass",
          "regproc", "regprocedure", "regtype", "bit", "varbit", "xml", "ltree"}
ENUMS = sorted({t["name"] for t in TYPES.values() if t["kind"] == "e" and t["ns"] == "public"})


def ident(name: str) -> str:
    return name if name.replace("_", "a").isalnum() and not name[0].isdigit() else json.dumps(name)


def ts_type(oid: int) -> str:
    t = TYPES.get(str(oid))
    if t is None:
        return "unknown"
    if t["cat"] == "A" and t["elem"]:
        return f"{ts_type(t['elem'])}[]"
    if t["kind"] == "e":
        return f'Database["public"]["Enums"]["{t["name"]}"]' if t["ns"] == "public" else "string"
    if t["kind"] == "d":
        return "unknown"
    name = t["name"]
    if name == "bool":
        return "boolean"
    if name in NUMBER:
        return "number"
    if name in STRING:
        return "string"
    if name in ("json", "jsonb"):
        return "Json"
    if name == "void":
        return "undefined"
    if t["rel"] and t["rel"] in REL_BY_OID:
        rel = REL_BY_OID[t["rel"]]
        section = "Tables" if rel["kind"] in ("r", "p") else "Views"
        return f'Database["public"]["{section}"]["{rel["name"]}"]["Row"]'
    return "unknown"


def relationships(rel_name: str) -> str:
    rows = [f for f in schema["fks"] if f["rel"] == rel_name]
    if not rows:
        return "[]"
    out = ["["]
    for f in rows:
        out += [
            "          {",
            f'            foreignKeyName: {json.dumps(f["name"])}',
            f'            columns: {json.dumps(f["cols"])}',
            f'            isOneToOne: {"true" if f["one"] else "false"}',
            f'            referencedRelation: {json.dumps(f["ref"])}',
            f'            referencedColumns: {json.dumps(f["refcols"])}',
            "          },",
        ]
    out.append("        ]")
    return "\n".join(out)


def col_type(rel: dict, c: dict) -> str:
    known = JSON_COLUMNS.get(f"{rel['name']}.{c['name']}")
    return known["type"] if known else ts_type(c["type"])


def table_block(rel: dict) -> list[str]:
    lines = [f"      {ident(rel['name'])}: {{", "        Row: {"]
    for c in rel["cols"]:
        null = "" if c["notnull"] else " | null"
        lines.append(f"          {ident(c['name'])}: {col_type(rel, c)}{null}")
    lines.append("        }")
    for section in ("Insert", "Update"):
        lines.append(f"        {section}: {{")
        for c in rel["cols"]:
            t = col_type(rel, c) + ("" if c["notnull"] else " | null")
            if c["generated"]:
                lines.append(f"          {ident(c['name'])}?: never")
                continue
            optional = section == "Update" or not c["notnull"] or c["default"] or c["identity"]
            lines.append(f"          {ident(c['name'])}{'?' if optional else ''}: {t}")
        lines.append("        }")
    lines.append(f"        Relationships: {relationships(rel['name'])}")
    lines.append("      }")
    return lines


def view_block(rel: dict) -> list[str]:
    lines = [f"      {ident(rel['name'])}: {{", "        Row: {"]
    for c in rel["cols"]:
        lines.append(f"          {ident(c['name'])}: {ts_type(c['type'])} | null")
    lines.append("        }")
    lines.append(f"        Relationships: {relationships(rel['name'])}")
    lines.append("      }")
    return lines


def function_variant(fn: dict) -> str:
    names = fn["argnames"] or []
    types = fn["argtypes"] or []
    modes = fn["argmodes"] or ["i"] * len(types)
    ins = [(names[i] if i < len(names) else f"arg{i}", types[i]) for i, m in enumerate(modes) if m in ("i", "b", "v")]
    outs = [(names[i], types[i]) for i, m in enumerate(modes) if m in ("o", "b", "t")]
    first_default = len(ins) - fn["ndefaults"]
    if ins:
        # SQL functions take NULL for any argument unless they are STRICT
        null = "" if fn.get("strict") else " | null"
        args = "{ " + "; ".join(f"{ident(n)}{'?' if i >= first_default else ''}: {ts_type(t)}{null}" for i, (n, t) in enumerate(ins)) + " }"
    else:
        args = "Record<PropertyKey, never>"
    if outs:
        ret = "{ " + "; ".join(f"{ident(n)}: {ts_type(t)}" for n, t in outs) + " }"
        ret = f"{ret}[]" if fn["set"] else ret
    else:
        ret = ts_type(fn["ret"])
        if fn["set"]:
            ret = f"{ret}[]" if " " not in ret else f"({ret})[]"
    return f"{{ Args: {args}; Returns: {ret} }}"


def main():
    out = [
        "// GENERATED by `npm run db:types` from supabase/migrations (scripts/gen-types.py).",
        "// Do not edit by hand: change a migration and run it again.",
        "",
        *[f'import type {{ {", ".join(sorted({v["type"].rstrip("[]") for v in JSON_COLUMNS.values() if v["from"] == mod}))} }} from "{mod}"' for mod in sorted({v["from"] for v in JSON_COLUMNS.values()})],
        "",
        "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]",
        "",
        "export type Database = {",
        "  public: {",
        "    Tables: {",
    ]
    for rel in schema["rels"]:
        if rel["kind"] in ("r", "p"):
            out += table_block(rel)
    out += ["    }", "    Views: {"]
    for rel in schema["rels"]:
        if rel["kind"] in ("v", "m"):
            out += view_block(rel)
    out += ["    }", "    Functions: {"]
    by_name: dict[str, list[dict]] = {}
    for fn in schema["funcs"]:
        by_name.setdefault(fn["name"], []).append(fn)
    for name in sorted(by_name):
        variants = [function_variant(f) for f in by_name[name]]
        out.append(f"      {ident(name)}: " + " | ".join(dict.fromkeys(variants)))
    out += ["    }", "    Enums: {"]
    for e in ENUMS:
        oid = next(k for k, t in TYPES.items() if t["name"] == e and t["ns"] == "public" and t["kind"] == "e")
        out.append(f"      {ident(e)}: " + " | ".join(json.dumps(v) for v in schema.get("enum_values", {}).get(oid, [])) )
    out += ["    }", "    CompositeTypes: Record<string, never>", "  }", "}", ""]
    out += [
        'type PublicSchema = Database["public"]',
        'export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]',
        'export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]',
        'export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]',
        'export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]',
        'export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]',
        "",
    ]
    sys.stdout.write("\n".join(out))


main()
