-- =============================================================================
-- GGG.Cafe — How to Keep the Book game: answer key (generated; do not edit by hand)
-- Source: supabase/iq/scorebook-game.json
-- Regenerate: python3 scripts/iq/build-game-key.py <new migration file>
-- =============================================================================

delete from private.scorebook_game_key;
insert into private.scorebook_game_key (play, boxes) values
  (1, '{"V1-1":{"hit":1,"path":1}}'::jsonb),
  (2, '{"V2-1":{"play":"K","out":1},"V1-1":{"hit":1,"path":1}}'::jsonb),
  (3, '{"V3-1":{"hit":2,"path":2},"V1-1":{"hit":1,"path":4,"rbi":"21"}}'::jsonb),
  (4, '{"V4-1":{"play":"6-3","out":2},"V3-1":{"hit":2,"path":3}}'::jsonb),
  (5, '{"V5-1":{"play":"F8","out":3,"lastOut":true},"V3-1":{"hit":2,"path":3}}'::jsonb),
  (6, '{"H1-1":{"reached":"BB","path":1}}'::jsonb),
  (7, '{"H2-1":{"play":"6-4-3 DP","out":2},"H1-1":{"reached":"BB","path":1,"play":"6-4","out":1}}'::jsonb),
  (8, '{"H3-1":{"play":"Kc","out":3,"lastOut":true}}'::jsonb),
  (9, '{"V6-2":{"play":"4-3","out":1}}'::jsonb),
  (10, '{"V7-2":{"play":"L5","out":2}}'::jsonb),
  (11, '{"V8-2":{"play":"K","out":3,"lastOut":true}}'::jsonb),
  (12, '{"H4-2":{"play":"E6","path":1}}'::jsonb),
  (13, '{"H5-2":{"reached":"SAC","play":"5-3","out":1},"H4-2":{"play":"E6","path":2}}'::jsonb),
  (14, '{"H6-2":{"hit":1,"path":1},"H4-2":{"play":"E6","path":4,"rbi":"44"}}'::jsonb),
  (15, '{"H7-2":{"hit":2,"path":2},"H6-2":{"hit":1,"path":4,"rbi":"12"}}'::jsonb);

insert into private.scorebook_game_line (id, line)
values (true, '{"V":[1,0],"H":[0,2]}'::jsonb)
on conflict (id) do update set line = excluded.line;
