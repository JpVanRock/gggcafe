-- Keys (migration 20261121132501):
--   * every table in public and private has a primary key;
--   * every foreign key has an index that starts with its columns, so deletes that cascade
--     and joins on it don't scan the whole table. Links to auth.users are the exception: they
--     record who made or changed a row and are only scanned when an account is deleted.
do $$
declare
  r record;
begin
  for r in select c.oid::regclass as t from pg_class c
            where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace) and c.relkind in ('r', 'p')
              and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p') loop
    raise exception 'FAIL: % has no primary key', r.t;
  end loop;
  for r in select k.conrelid::regclass as t, k.conname,
                  (select string_agg(a.attname, ', ' order by array_position(k.conkey, a.attnum)) from pg_attribute a
                    where a.attrelid = k.conrelid and a.attnum = any (k.conkey)) as cols
             from pg_constraint k
            where k.contype = 'f' and k.connamespace in ('public'::regnamespace, 'private'::regnamespace)
              and k.confrelid <> 'auth.users'::regclass
              and not exists (
                select 1 from pg_index i
                 where i.indrelid = k.conrelid
                   and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(k.conkey)] @> k.conkey
                   and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(k.conkey)] <@ k.conkey) loop
    raise exception 'FAIL: foreign key % on % (%) has no index: create index on % (%)', r.conname, r.t, r.cols, r.t, r.cols;
  end loop;
end $$;
