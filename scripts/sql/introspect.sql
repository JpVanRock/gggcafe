-- The public schema as one JSON document, for scripts/gen-types.py.
with
types as (
  select coalesce(jsonb_object_agg(t.oid::text, jsonb_build_object(
           'name', t.typname, 'kind', t.typtype, 'cat', t.typcategory, 'elem', t.typelem::int,
           'rel', t.typrelid::int, 'ns', n.nspname)), '{}')
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
),
rels as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'oid', c.oid::int, 'name', c.relname, 'kind', c.relkind,
           'cols', (select jsonb_agg(jsonb_build_object(
                      'name', a.attname, 'type', a.atttypid::int, 'notnull', a.attnotnull, 'default', a.atthasdef,
                      'identity', a.attidentity <> '', 'generated', a.attgenerated <> '') order by a.attnum)
                      from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
         ) order by c.relname), '[]')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
),
fks as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', con.conname, 'rel', cl.relname, 'ref', fcl.relname,
           'cols', (select jsonb_agg(a.attname order by k.o) from unnest(con.conkey) with ordinality k(n, o)
                      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n),
           'refcols', (select jsonb_agg(a.attname order by k.o) from unnest(con.confkey) with ordinality k(n, o)
                         join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n),
           'one', exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique and i.indpred is null
                           and i.indexprs is null and i.indkey::int2[] @> con.conkey and i.indkey::int2[] <@ con.conkey)
         ) order by cl.relname, con.conname), '[]')
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
    join pg_class fcl on fcl.oid = con.confrelid join pg_namespace fn on fn.oid = fcl.relnamespace
   where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
),
funcs as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.proname, 'set', p.proretset, 'ret', p.prorettype::int,
           'argtypes', coalesce(to_jsonb(p.proallargtypes::int[]), to_jsonb(p.proargtypes::int[])),
           'argnames', coalesce(to_jsonb(p.proargnames), '[]'),
           'argmodes', coalesce(to_jsonb(p.proargmodes::text[]), '[]'),
           'nin', p.pronargs, 'ndefaults', p.pronargdefaults, 'strict', p.proisstrict
         ) order by p.proname, p.oid), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
),
enum_values as (
  select coalesce(jsonb_object_agg(x.oid, x.vals), '{}')
    from (select e.enumtypid::text as oid, jsonb_agg(e.enumlabel order by e.enumsortorder) as vals
            from pg_enum e group by e.enumtypid) x
)
select jsonb_build_object('types', (select * from types), 'rels', (select * from rels),
                          'fks', (select * from fks), 'funcs', (select * from funcs),
                          'enum_values', (select * from enum_values));
