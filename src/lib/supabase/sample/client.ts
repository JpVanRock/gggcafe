import "server-only";
// A stand-in for the Supabase client in sample-data mode (see ./enabled.ts): a small PostgREST
// look-alike over the fictional rows in ./data.ts. Reads filter, order, limit and embed related
// rows; writes do nothing and succeed. Signed in as the sample admin.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FK, TABLES, U, sampleRpc, type Row } from "./data";

type Field =
  | { kind: "col"; alias: string; col: string }
  | { kind: "embed"; alias: string; table: string; hint: string | null; fields: Field[] }
  | { kind: "star" }
  | { kind: "count" };

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseSelect(s: string): Field[] {
  return splitTop(s.replace(/\s+/g, " ")).map((part): Field => {
    if (part === "*") return { kind: "star" };
    if (part === "count") return { kind: "count" };
    const paren = part.indexOf("(");
    if (paren >= 0) {
      const head = part.slice(0, paren);
      const inner = part.slice(paren + 1, part.lastIndexOf(")"));
      const [alias, target] = head.includes(":") ? head.split(":") : [head, head];
      const [table, hint] = target.split("!");
      return { kind: "embed", alias: alias.trim(), table: table.trim(), hint: hint && hint !== "inner" ? hint.trim() : null, fields: parseSelect(inner) };
    }
    const [alias, col] = part.includes(":") ? part.split(":") : [part, part];
    return { kind: "col", alias: alias.trim(), col: col.trim() };
  });
}

function project(table: string, row: Row, fields: Field[]): Row {
  const out: Row = {};
  for (const f of fields) {
    if (f.kind === "star") Object.assign(out, Object.fromEntries(Object.entries(row).filter(([, v]) => typeof v !== "object" || v === null || Array.isArray(v))));
    else if (f.kind === "col") out[f.alias] = row[f.col] ?? row[f.alias] ?? null;
    else if (f.kind === "embed") {
      if (f.alias in row && (row[f.alias] === null || typeof row[f.alias] === "object")) {
        out[f.alias] = row[f.alias]; // an embed written into the sample row itself
        continue;
      }
      const rows = TABLES[f.table] ?? [];
      const fk = f.hint ?? FK[f.table];
      if (fk && fk in row) {
        const hit = rows.find((r) => r.id === row[fk]);
        out[f.alias] = hit ? project(f.table, hit, f.fields) : null;
      } else {
        const back = FK[table];
        const kids = back ? rows.filter((r) => r[back] === row.id) : [];
        out[f.alias] = f.fields.length === 1 && f.fields[0].kind === "count" ? [{ count: kids.length }] : kids.map((k) => project(f.table, k, f.fields));
      }
    }
  }
  return out;
}

type Filter = (r: Row) => boolean;
const val = (v: string) => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);
function cond(col: string, op: string, raw: string): Filter {
  const has = (r: Row) => r[col] !== null && r[col] !== undefined;
  switch (op) {
    case "eq": return (r) => String(r[col]) === raw;
    case "neq": return (r) => String(r[col]) !== raw;
    case "is": return (r) => (val(raw) === null ? !has(r) : r[col] === val(raw));
    case "gte": return (r) => has(r) && r[col] >= raw;
    case "lte": return (r) => has(r) && r[col] <= raw;
    case "gt": return (r) => has(r) && r[col] > raw;
    case "lt": return (r) => has(r) && r[col] < raw;
    case "in": {
      const set = raw.replace(/^\(|\)$/g, "").split(",").map((x) => x.trim());
      return (r) => set.includes(String(r[col]));
    }
    default: return () => true;
  }
}

type Result = { data: any; error: null; count?: number };

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private lim: number | null = null;
  private fields: Field[] = [{ kind: "star" }];
  private mode: "one" | "maybe" | null = null;
  private head = false;
  private write = false;
  constructor(private table: string) {}
  select(s = "*", opts?: { head?: boolean; count?: string }) { this.fields = parseSelect(s); if (opts?.head) this.head = true; return this; }
  insert() { this.write = true; return this; }
  update() { this.write = true; return this; }
  upsert() { this.write = true; return this; }
  delete() { this.write = true; return this; }
  eq(c: string, v: unknown) { this.filters.push(cond(c, "eq", String(v))); return this; }
  neq(c: string, v: unknown) { this.filters.push(cond(c, "neq", String(v))); return this; }
  gte(c: string, v: unknown) { this.filters.push(cond(c, "gte", String(v))); return this; }
  lte(c: string, v: unknown) { this.filters.push(cond(c, "lte", String(v))); return this; }
  gt(c: string, v: unknown) { this.filters.push(cond(c, "gt", String(v))); return this; }
  lt(c: string, v: unknown) { this.filters.push(cond(c, "lt", String(v))); return this; }
  is(c: string, v: unknown) { this.filters.push(cond(c, "is", String(v))); return this; }
  in(c: string, v: unknown[]) { const set = v.map(String); this.filters.push((r) => set.includes(String(r[c]))); return this; }
  contains() { return this; }
  ilike() { return this; }
  match(o: Row) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  not(c: string, op: string, v: unknown) { const f = cond(c, op, String(v)); this.filters.push((r) => !f(r)); return this; }
  or(s: string) {
    const parts = splitTop(s).map((p) => {
      const m = /^([a-z_.]+)\.([a-z]+)\.(.*)$/.exec(p);
      return m ? cond(m[1], m[2], m[3]) : () => true;
    });
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) { this.orders.push({ col, asc: o?.ascending !== false, nullsFirst: o?.nullsFirst }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.lim = b - a + 1; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  single() { this.mode = "one"; return this; }
  then<A, B>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }
  private run(): Result {
    if (this.write) return { data: this.mode ? { id: "00000000-0000-4000-8000-000000000000" } : [], error: null };
    let rows = (TABLES[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    for (const o of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[o.col];
        const y = b[o.col];
        if (x === y) return 0;
        if (x === null || x === undefined) return o.nullsFirst ? -1 : 1;
        if (y === null || y === undefined) return o.nullsFirst ? 1 : -1;
        return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
      });
    }
    const total = rows.length;
    if (this.head) return { data: null, error: null, count: total };
    if (this.lim !== null) rows = rows.slice(0, this.lim);
    const data = rows.map((r) => project(this.table, r, this.fields));
    if (this.mode) return { data: data[0] ?? null, error: null };
    return { data, error: null, count: total };
  }
}

const SAMPLE_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='#FE1F7C'/><text x='32' y='40' font-size='18' text-anchor='middle' fill='#ffffff' font-family='sans-serif' font-weight='700'>14U</text></svg>");

export function sampleClient() {
  return {
    from: (table: string) => new Query(table),
    rpc: (name: string, args?: Row) => Promise.resolve({ data: sampleRpc(name, args), error: null }),
    auth: {
      getClaims: async () => ({ data: { claims: { sub: U.admin, email: "coach@sample.test" } }, error: null }),
      getUser: async () => ({ data: { user: { id: U.admin, email: "coach@sample.test" } }, error: null }),
    },
    storage: {
      from: () => ({
        createSignedUrls: async () => ({ data: [], error: null }),
        // a placeholder for the sample team's logo (team-logos), so the header logo renders; nothing else signs one
        createSignedUrl: async (path?: string) => ({ data: path?.endsWith(".png") ? { signedUrl: SAMPLE_LOGO } : null, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
}
